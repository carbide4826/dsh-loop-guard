// 事件域聚合入口(dshp 生成):每域一行调用,实现见 ./domains/*.ts。
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './index.ts'
import type { Chains } from './chain.ts'
import { registerToolsListeners } from "./domains/tools.ts"
import { registerAgentListeners } from "./domains/agent.ts"

/**
 * 注册已选事件域的监听。
 * @param ctx - Cordis 上下文
 * @param config - 已解析的插件配置,整包透传给各域
 * @param chains - apply 造的共享状态表
 */
export function registerEventListeners(ctx: Context, config: Config, chains: Chains): void {
    registerToolsListeners(ctx, config, chains)
    registerAgentListeners(ctx, config, chains)
}
