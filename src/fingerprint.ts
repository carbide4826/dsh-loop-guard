// 指纹器:工具名 + 参数哈希 → 循环链键(03 计数器消费)。
// 两档粒度:exact=参数原样;normalized=先归一(相似参数并入同链键)。
import { createHash } from "node:crypto";

export type FingerprintGranularity = "exact" | "normalized";

/** 稳定序列化:递归键排序的紧凑 JSON,消除键序差异(两档粒度共用)。 */
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
 * 归一化 v1:字符串 trim + 连续空白折叠;超 120 字符截断;其余结构递归原样。
 * ⚠️ 已知并接受的语义(契约显式承认,见卡 S-dsh-loop-guard 第八栏):
 *    截断发生在哈希之前,故"前 120 字符相同、尾部实异"的两条入参会被并入同一链键。
 *    这是 v1 有意为之(为把"同文件反复小改"这类循环收进一条链),非 bug;
 *    误撞由 03 计数窗口 + 04 动作分级吸收,单次误撞不触发终止。
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
 * 计算循环链键指纹。
 * @param toolName - 工具名(进入指纹,跨工具不互撞)
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
