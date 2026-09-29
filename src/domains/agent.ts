import type { Context } from "@deepseek-ai/cordis";
import type { Config } from "../index.ts";
import { clear, hotSpot, type Chains, type HotSpot } from "../chain.ts";

/**
 * 注册 agent 域监听:用户插话清链 + 终止线判定。
 * @param ctx - Cordis 上下文
 * @param config - 已解析的插件配置,仅消费 terminateAt
 * @param chains - 跨域共享状态表
 */
export function registerAgentListeners(ctx: Context, config: Config, chains: Chains): void {
    const logger = ctx.logger("dsh-loop-guard");

    ctx.on("agent/pre-step", async ({ agent, messages }, next) => {
        // 用户插话清链。判 source.kind 而不是 role:我们注入的告警 role 也是 user、
        // kind 是 loop-guard,按 role 判会让第一次告警之后终止永远不成立。
        if (messages.some((message) => message.source.kind === "user")) {
            clear(chains, agent);
            return next();
        }

        const terminateAt = config.terminateAt;
        if (terminateAt === undefined) return next();

        let spot: HotSpot | undefined;
        try {
            spot = hotSpot(chains, agent);
        } catch (error) {
            // hotSpot 只读遍历,理论上不抛;真抛了放行,不能让守卫自己掐断 turn。
            logger.warn("hotSpot failed, step passes through unjudged: %s", error);
            return next();
        }
        if (!spot || spot.count < terminateAt) return next();

        // 终止 = reject 这一步,turn 收成 blocked,省掉的是这一步的模型调用。
        // 两个得自己留痕的后果:reject 不带 reason,事后从 jsonl 分不清是守卫掐断
        // 还是模型自己放弃;claim 已把 inbox 待处理消息取走且无回滚,reject 等于
        // 把这批输入判了结束,用户消息会丢。
        logger.warn("terminating turn: %s reached %d identical call(s) within the window (terminateAt=%d)", spot.fp, spot.count, terminateAt);
        return { kind: "reject" };
    });
}
