import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-tools"; // 只为事件类型提示
import type { Config } from "../index.ts";
import { observe, peek, type Chains, type Observation } from "../chain.ts";
import { computeFingerprint } from "../fingerprint.ts";
import { buildRepeatWarning } from "../warning.ts";

/**
 * 注册 tools 域监听:post-execute 计数 + 告警注入,pre-execute 判 deny。
 * @param ctx - Cordis 上下文
 * @param config - 已解析的插件配置,validateWindow 已校验
 * @param chains - 跨域共享状态表
 */
export function registerToolsListeners(ctx: Context, config: Config, chains: Chains): void {
    // 不用 console:stdout 会混进 --json 事件流。
    const logger = ctx.logger("dsh-loop-guard");

    // 计数挂 post-execute:被 deny 的调用也照常流经这里,链不会被自己的 deny 洗白。
    // capacity/threshold 已由 validateWindow 保证是合法整数,下面的非空断言安全。
    ctx.on("tools/post-execute", async (exec, _result, next) => {
        // 守卫自身抛异常降级成这一轮不计数:post-execute 里抛会把一次已成功的
        // 工具结果整体换成假失败,比少计一次脏得多。循环引用、BigInt 都会真抛。
        let obs: Observation | undefined;
        try {
            const fp = computeFingerprint(exec.name, exec.arguments, config.granularity);
            // 豁免 = 不计数;不计数则 deny/告警/终止三处都看不见它,判这一处就够。
            const exempt = (config.exempt ?? []).some((p) => fp.startsWith(p));
            if (!exempt) obs = observe(chains, exec.agent, fp, config.capacity!);
        } catch (error) {
            logger.warn("observe failed, call not counted: %s", error);
        }

        // 先拿下游决议,再把告警插到它前面,不改 accept/block 语义。
        // 下游的异常不归守卫吞,next() 留在 try 外。
        const decision = await next();

        // 告警只在第 threshold-1 次发一次,之后的重复交给 pre-execute 的 deny。
        try {
            if (obs && obs.count === config.threshold! - 1) {
                const warning = buildRepeatWarning(exec.name, obs.count);
                return { ...decision, additionalContexts: [warning, ...(decision.additionalContexts ?? [])] };
            }
        } catch (error) {
            logger.warn("warning injection failed, downstream decision kept as-is: %s", error);
        }
        return decision;
    });

    // deny 挂 pre-execute:这边的决议类型没有 additionalContexts,告警插不进来。
    ctx.on("tools/pre-execute", async (exec, next) => {
        let seen = 0;
        let fp = "";
        try {
            fp = computeFingerprint(exec.name, exec.arguments, config.granularity);
            // 只读 peek 不 observe:计数只在 post-execute 推进,两边都推会把同一次调用数两遍。
            seen = peek(chains, exec.agent, fp);
        } catch (error) {
            // pre 侧抛异常会让工具根本不执行、且绕过 post-execute,这条链从此永久少计一次,所以放行。
            logger.warn("peek failed, call passes through unjudged: %s", error);
            return next();
        }
        // 命中就直接返回,不调 next();宿主仍会把 deny 物化成错误工具结果,
        // 该结果照常走 post-execute 进链。
        // 用 >= 而非 ===:被 deny 的调用继续进链,窗会被同指纹填满,
        // === 只成立一次,之后守卫就哑了,模型能无限重试到终止线。
        if (seen >= config.threshold! - 1) {
            return {
                kind: "deny",
                // reason 原样进模型可见的错误结果,每轮循环出现一次,只留改道所需信息。
                reason: `loop-guard: blocked repeat ${exec.name} (seen ${seen}). Change arguments or stop.`,
                // info 只落持久投影不进模型,留指纹供事后反查是哪条链触发的。
                info: { name: "dsh-loop-guard", code: "REPEAT_CALL_DENIED", reason: `${fp} blocked-at=${seen + 1}` },
            };
        }
        return next();
    });
}
