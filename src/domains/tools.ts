import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools' // 事件类型来源:引入后事件名与参数才有类型提示

/**
 * tools 域监听(代表事件:1 个 waterfall + 1 个 emit)。
 * 域内全部事件与 mode 见官方 event-producer-consumer 文档。
 * @param ctx - Cordis 上下文
 */
export function registerToolsListeners(ctx: Context): void {
    // waterfall 权限门:不拦截就 return next(),拦截返回 deny
    ctx.on('tools/pre-execute', async (exec, next) => {
        // exec.name / exec.arguments = 工具名与已解析入参;TODO: 你的拦截逻辑
        // return { kind: 'deny', reason: 'not allowed' }
        return next()
    })

    // emit 观察:工具跑完后的最终结果(只读快照,失败也照常送达)
    ctx.on('tools/result', (exec, result) => {
        // TODO: 审计、统计等
        console.log(`[dsh-loop-guard] tool ${exec.name} finished`)
        void result
    })
}
