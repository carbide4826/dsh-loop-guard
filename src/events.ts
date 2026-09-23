// 事件域聚合入口(由 dshp 生成):每域一行调用,实现见 ./domains/*.ts。
import type { Context } from '@deepseek-ai/cordis'
import { registerToolsListeners } from "./domains/tools.ts"

/**
 * 注册已选事件域的监听。
 * @param ctx - Cordis 上下文
 */
export function registerEventListeners(ctx: Context): void {
    registerToolsListeners(ctx) // 域:工具执行
}
