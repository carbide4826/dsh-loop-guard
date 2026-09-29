// 注入给模型的告警上下文。官方 MessageSourceMap 没有守卫这类来源,自建 kind 借声明合并注册。
import { randomUUID } from "node:crypto";
import { brandString } from "@deepseek-ai/dsh-brand";
import type { ContextFormed, MessageId, UserMessage } from "@deepseek-ai/dsh-llm";

declare module "@deepseek-ai/dsh-llm" {
    interface MessageSourceMap {
        "loop-guard": { kind: "loop-guard" } & ContextFormed;
    }
}

/**
 * 造一条重复调用的 user 角色告警。直接在类型内构造:运行时链上没有环节
 * 生成或校验 id,唯一门槛是 MessageId 的品牌类型,用 brandString 满足。
 * @param toolName - 重复的工具名
 * @param count - 该指纹在滑窗内的出现次数
 * @returns 注入模型上下文的 user 角色消息
 */
export function buildRepeatWarning(toolName: string, count: number): UserMessage {
    const id = brandString<MessageId>(randomUUID());
    // 文案每轮循环进一次模型上下文,只留工具名/计数/改道指令。
    const text = `[loop-guard] repeat ${toolName} x${count}. Change arguments or stop.`;
    return {
        id,
        role: "user",
        content: [{ type: "text", text }],
        source: { kind: "loop-guard" },
    };
}
