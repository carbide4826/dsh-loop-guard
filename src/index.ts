// dsh-loop-guard — 插件入口(由 dshp 生成)。
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { registerEventListeners } from "./events.ts";
import type { FingerprintGranularity } from "./fingerprint.ts";

// 插件名:Cordis 注册名(loader 诊断与其他插件引用用)
export const name = "dsh-loop-guard";

/** 插件配置(样例:把 example 换成你的配置项)。 */
export interface Config {
    /** TODO: 配置项说明 */
    example: string;
    /** 指纹粒度:exact=参数原样;normalized=先归一(默认,相似参数并入同链键) */
    granularity?: FingerprintGranularity;
}

export const Config: z<Config> = z.object({
    example: z.string().required(),
    granularity: z.union(["exact", "normalized"]),
});

/**
 * 插件入口:各能力的注册调用(由 dshp 生成)。
 * @param ctx - Cordis 上下文
 * @param config - 已解析的插件配置
 */
export function apply(ctx: Context, config: Config): void {
    registerEventListeners(ctx, config);
}
