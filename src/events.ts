// 事件域聚合入口(由 dshp 生成):每域一行调用,实现见 ./domains/*.ts。
import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './index.ts'
import { registerToolsListeners } from "./domains/tools.ts"

/**
 * 注册已选事件域的监听。
 * @param ctx - Cordis 上下文
 * @param config - 已解析的插件配置(整包透传给各域,03 计数器消费 granularity)
 */
export function registerEventListeners(ctx: Context, config: Config): void {
    registerToolsListeners(ctx, config) // 域:工具执行
}
