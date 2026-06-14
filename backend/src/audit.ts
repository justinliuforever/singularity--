/**
 * 创作体检台（P3a · 确定性逻辑检查）：纯图算法，不依赖求解器、不依赖 LLM。
 * 抓：①矛盾(contradicts 边) ②因果环(SCC/自环=剧情死循环) ③结局缺前因支撑。
 * 外部锚定原则：这些都是图上可证的事实，不让 LLM 自评。
 */
import { loadStory } from "./story.js";

export type Severity = "error" | "warn" | "info";
export interface Finding {
  id: string;
  type: "contradiction" | "cycle" | "unmotivated" | "temporal" | "unsolvable";
  severity: Severity;
  title: string;
  detail: string;
  events: string[]; // 涉及的事件 id（点击可跳详图）
  bySolver?: boolean; // 是否由 ASP 求解器（clingo）确认
}

/** Tarjan 强连通分量 */
function tarjan(nodes: string[], out: Map<string, string[]>): string[][] {
  let idx = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  const strong = (v: string) => {
    index.set(v, idx); low.set(v, idx); idx++;
    stack.push(v); onStack.add(v);
    for (const w of out.get(v) ?? []) {
      if (!index.has(w)) { strong(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) === index.get(v)) {
      const comp: string[] = [];
      let w: string;
      do { w = stack.pop()!; onStack.delete(w); comp.push(w); } while (w !== v);
      sccs.push(comp);
    }
  };
  for (const n of nodes) if (!index.has(n)) strong(n);
  return sccs;
}

export function auditStory() {
  const { events, edges } = loadStory();
  const byId = new Map(events.map((e) => [e.id, e]));
  const title = (id: string) => byId.get(id)?.title ?? id;
  const causal = edges.filter((e) => e.type !== "contradicts");

  const out = new Map<string, string[]>();
  const inc = new Map<string, string[]>();
  for (const e of events) { out.set(e.id, []); inc.set(e.id, []); }
  for (const ed of causal) { out.get(ed.from)?.push(ed.to); inc.get(ed.to)?.push(ed.from); }

  const findings: Finding[] = [];

  // ① 矛盾：contradicts 边
  for (const ed of edges.filter((e) => e.type === "contradicts")) {
    findings.push({ id: `con-${ed.from}-${ed.to}`, type: "contradiction", severity: "warn", title: "事实/口径矛盾", detail: ed.note || `「${title(ed.from)}」与「${title(ed.to)}」相互矛盾`, events: [ed.from, ed.to] });
  }

  // ② 因果环：SCC(>1) + 自环
  for (const scc of tarjan(events.map((e) => e.id), out)) {
    if (scc.length > 1) findings.push({ id: `cyc-${scc[0]}`, type: "cycle", severity: "error", title: "因果环（剧情逻辑死循环）", detail: scc.map(title).join(" → ") + " → …", events: scc });
  }
  for (const ed of causal) if (ed.from === ed.to) findings.push({ id: `self-${ed.from}`, type: "cycle", severity: "error", title: "自因果环", detail: `「${title(ed.from)}」因果指向自己`, events: [ed.from] });

  // ③ 结局/结果缺前因支撑
  for (const e of events) {
    if ((e.type === "Outcome" || e.actOrd === 12) && (inc.get(e.id)?.length ?? 0) === 0) {
      findings.push({ id: `unmot-${e.id}`, type: "unmotivated", severity: "warn", title: "结局缺前因支撑", detail: `「${e.title}」没有任何前因事件指向它（玩家无从推演到它）`, events: [e.id] });
    }
  }

  const order: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);

  const stats = {
    events: events.length,
    edges: edges.length,
    contradictions: findings.filter((f) => f.type === "contradiction").length,
    cycles: findings.filter((f) => f.type === "cycle").length,
    unmotivated: findings.filter((f) => f.type === "unmotivated").length,
    orphan: events.filter((e) => (inc.get(e.id)?.length ?? 0) === 0).length, // 无前因（部分提取，仅参考）
    dangling: events.filter((e) => (out.get(e.id)?.length ?? 0) === 0).length, // 无后果
  };

  return { findings, stats };
}
