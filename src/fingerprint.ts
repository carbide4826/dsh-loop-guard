// 指纹器:工具名 + 参数哈希 → 链键。exact=参数原样;normalized=先归一。
import { createHash } from "node:crypto";

export type FingerprintGranularity = "exact" | "normalized";

/**
 * 稳定序列化:递归键排序 + 紧凑 JSON,消除键序差异。
 * @param value - 待序列化的值
 * @returns 规范化的 JSON 字符串
 */
function canonicalize(value: unknown): string {
    if (value === null || typeof value !== "object")
        return JSON.stringify(value) ?? "undefined";
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
    const entries = Object.entries(value as Record<string, unknown>).sort(
        ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

/**
 * 归一化:字符串 trim + 连续空白折叠,超 120 字符截断;其余结构递归原样。
 * 截断在哈希前,前缀同、尾部异的两条入参会并进同一链键——有意为之
 * (把同文件反复小改这类循环收进一条链),误撞由计数窗口与动作分级吸收。
 * @param value - 待归一的值
 * @returns 归一后的值
 */
function normalize(value: unknown): unknown {
    if (typeof value === "string") {
        const s = value.trim().replace(/\s+/g, " ");
        return s.length > 120 ? s.slice(0, 120) : s;
    }
    if (Array.isArray(value)) return value.map(normalize);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([k, v]) => [
                k,
                normalize(v),
            ]),
        );
    }
    return value;
}

/**
 * 计算链键指纹。
 * @param toolName - 工具名,进入指纹,跨工具不互撞
 * @param args - 工具已解析入参
 * @param granularity - 粒度档位,默认 normalized
 * @returns `<工具名>:<sha256 前 16 位 hex>`
 */
export function computeFingerprint(
    toolName: string,
    args: unknown,
    granularity: FingerprintGranularity = "normalized",
): string {
    const payload = granularity === "normalized" ? normalize(args) : args;
    const hash = createHash("sha256")
        .update(canonicalize(payload))
        .digest("hex")
        .slice(0, 16);
    return `${toolName}:${hash}`;
}
