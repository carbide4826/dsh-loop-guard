// dsh-loop-guard 插件入口(dshp 生成)。
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { registerEventListeners } from "./events.ts";
import { createChains, validateWindow } from "./chain.ts";
import type { FingerprintGranularity } from "./fingerprint.ts";

export const name = "dsh-loop-guard";

/** 插件配置。capacity/threshold 必填无默认,缺失时 validateWindow 在 apply() 里抛。 */
export interface Config {
    /** 指纹粒度,默认 normalized(相似参数并入同链键)。 */
    granularity?: FingerprintGranularity;
    /** 滑窗容量 N:每个 agent 的链保留最近 N 次调用。 */
    capacity?: number;
    /** 命中阈值 M:窗内同一指纹出现 >= M 次视为循环;须 >= 2 且 <= capacity。 */
    threshold?: number;
    /** 终止线 T:窗内某链键攒到 >= T 次时 reject 掉下一步,turn 收成 blocked。省 = 不启用终止;给了须 > threshold 且 <= capacity。 */
    terminateAt?: number;
    /** 豁免清单:条目前缀匹配指纹串,写工具名即豁免该工具全部调用,写 toolName:hash 前缀可精确到参数族。命中即不计数。省 = 不豁免。 */
    exempt?: string[];
}

export const Config: z<Config> = z.object({
    granularity: z.union(["exact", "normalized"]),
    capacity: z.number(),
    threshold: z.number(),
    terminateAt: z.number(),
    exempt: z.array(z.string()),
});

/**
 * 插件入口:校验配置、造共享状态表、注册事件监听。
 * @param ctx - Cordis 上下文
 * @param config - 已解析的插件配置
 */
export function apply(ctx: Context, config: Config): void {
    validateWindow(config.capacity, config.threshold, config.terminateAt);
    const chains = createChains();
    registerEventListeners(ctx, config, chains);
}
