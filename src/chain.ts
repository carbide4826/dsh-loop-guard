// 计数器状态层:纯状态,不碰 ctx,不 import 事件。链键 = 指纹返回值;窗 = 定长调用序号滑窗。
import type { ToolExecution } from "@deepseek-ai/dsh-tools";

/**
 * 链键按真实 Agent 持有,不按 session:一个 session 可挂多个 agent,
 * 用 session 会把 subagent 的循环混进主 agent 的链。
 * 可为 undefined(直接 ctx.tools.execute() 的调用没有 agent,不计数)。
 */
export type AgentRef = NonNullable<ToolExecution["agent"]>;

/** 单条链:定长滑窗,push 挤掉最旧。窗口单位是调用序号,不是时间。 */
export interface Chain {
    ring: string[];
}

/** agent → 滑窗。WeakMap:agent 被回收时链自动消失。 */
export type Chains = WeakMap<AgentRef, Chain>;

/**
 * 造一张空状态表;链在首次 observe 命中时惰性建。
 * @returns 空状态表
 */
export function createChains(): Chains {
    return new WeakMap();
}

/** observe 返回值:fp 在当前窗内的出现次数。 */
export interface Observation {
    count: number;
}

/**
 * 推进一次计数:把 fp 压入该 agent 的滑窗,返回窗内出现次数。无 agent 不建链、不计数。
 * @param chains - 共享状态表
 * @param agent - 本次调用的 Agent,可为 undefined(无 agent 不计数)
 * @param fp - 指纹,作滑窗元素
 * @param capacity - 滑窗定长
 * @returns fp 在窗内的出现次数;无 agent 返回 undefined
 */
export function observe(chains: Chains, agent: AgentRef | undefined, fp: string, capacity: number): Observation | undefined {
    if (!agent) return undefined;
    let chain = chains.get(agent);
    if (!chain) {
        chain = { ring: [] };
        chains.set(agent, chain);
    }
    chain.ring.push(fp);
    if (chain.ring.length > capacity) chain.ring.shift();
    let count = 0;
    for (const x of chain.ring) if (x === fp) count++;
    return { count };
}

/**
 * 只读查窗内 fp 出现次数,不推进滑窗。
 * pre-execute 用它而非 observe:计数只在 post-execute 推进,两边都推会把同一次调用数两遍。
 * 无 agent / 无链返回 0;0 恒小于 threshold-1(>=1),不会误 deny。
 * @param chains - 共享状态表
 * @param agent - 本次调用的 Agent,可为 undefined
 * @param fp - 指纹
 * @returns fp 在窗内的出现次数
 */
export function peek(chains: Chains, agent: AgentRef | undefined, fp: string): number {
    const ring = agent ? chains.get(agent)?.ring : undefined;
    if (!ring) return 0;
    let count = 0;
    for (const x of ring) if (x === fp) count++;
    return count;
}

/** hotSpot 返回值:窗内出现次数最多的链键及其次数。 */
export interface HotSpot {
    fp: string;
    count: number;
}

/**
 * 只读找窗内最热的链键。agent 域判终止用它:pre-step 手上只有 agent,
 * 没有工具名与参数,复用不了 peek。
 * @param chains - 共享状态表
 * @param agent - 要查的 Agent,可为 undefined
 * @returns 窗内最热的链键及其次数;无 agent / 空窗返回 undefined,调用方据此不终止
 */
export function hotSpot(chains: Chains, agent: AgentRef | undefined): HotSpot | undefined {
    const ring = agent ? chains.get(agent)?.ring : undefined;
    if (!ring || ring.length === 0) return undefined;
    const counts = new Map<string, number>();
    for (const fp of ring) counts.set(fp, (counts.get(fp) ?? 0) + 1);
    let hottest: HotSpot | undefined;
    for (const [fp, count] of counts) {
        if (!hottest || count > hottest.count) hottest = { fp, count };
    }
    return hottest;
}

/**
 * 清掉某 agent 的链(用户插话时调)。两域共用这一个口子,不裸调 chains.delete。
 * @param chains - 共享状态表
 * @param agent - 要清链的 Agent
 */
export function clear(chains: Chains, agent: AgentRef): void {
    chains.delete(agent);
}

/**
 * 装载期调参校验,非法即抛,不静默兜默认。
 * threshold >= 2(重复至少两次)且 <= capacity(否则窗内攒不够);
 * terminateAt 可省 = 不启用终止,给了须 > threshold(否则终止先于 deny)且 <= capacity。
 * @param capacity - 滑窗容量,须为 >= 1 的整数
 * @param threshold - 命中阈值,须为 >= 2 的整数且 <= capacity
 * @param terminateAt - 终止线,可省;给了须为 > threshold 且 <= capacity 的整数
 */
export function validateWindow(capacity: number | undefined, threshold: number | undefined, terminateAt?: number): void {
    if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1) {
        throw new Error(`dsh-loop-guard: invalid capacity ${String(capacity)} — window size must be an integer >= 1`);
    }
    if (typeof threshold !== "number" || !Number.isInteger(threshold) || threshold < 2) {
        throw new Error(`dsh-loop-guard: invalid threshold ${String(threshold)} — hit threshold must be an integer >= 2`);
    }
    if (threshold > capacity) {
        throw new Error(`dsh-loop-guard: threshold ${threshold} exceeds capacity ${capacity} — the window could never accumulate a hit`);
    }
    if (terminateAt === undefined) return;
    if (!Number.isInteger(terminateAt)) {
        throw new Error(`dsh-loop-guard: invalid terminateAt ${String(terminateAt)} — termination line must be an integer`);
    }
    if (terminateAt <= threshold) {
        throw new Error(`dsh-loop-guard: terminateAt ${terminateAt} must be greater than threshold ${threshold} — otherwise the turn ends before the deny line ever fires`);
    }
    if (terminateAt > capacity) {
        throw new Error(`dsh-loop-guard: terminateAt ${terminateAt} exceeds capacity ${capacity} — the window could never accumulate enough to terminate`);
    }
}
