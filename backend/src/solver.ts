/**
 * 创作体检台（P3b · ASP 求解器层）：用真 clingo（wasm）做需要约束求解的检查——
 * ① 时序一致性：因果的"因"不能晚于"果"（时序悖论）。
 * ② 可解性可达：每个"谜底/结局"能否从「玩家可见事件」经因果链推导出来。
 * 外部锚定：结论由 clingo 求解器给出，不让 LLM 自评（Huang ICLR2024）。
 */
import { loadStory } from "./story.js";
import type { Finding } from "./audit.js";
import type { StoryGraph } from "@liumang/shared";
// @ts-ignore clingo-wasm 无类型声明
import clingo from "clingo-wasm";

/** story_time 字符串 → 可比较年份（取不到则不参与时序检查） */
function yearOf(s: string): number | null {
  const m = s.match(/(\d{4})/);
  if (m) return +m[1];
  if (/(\d{1,2})\s*世纪/.test(s)) { const c = +RegExp.$1; return (c - 1) * 100 + 50; }
  if (/百年前|殖民/.test(s)) return 1900;
  return null;
}

/** 事件 id → ASP 安全原子名 */
const sym = (id: string) => "e" + id.replace(/[^A-Za-z0-9]/g, "").toLowerCase();

export async function solveStory(story: StoryGraph = loadStory()): Promise<{ findings: Finding[]; solver: string; temporal: number; unsolvable: number }> {
  const { events, edges } = story;
  const byId = new Map(events.map((e) => [e.id, e]));
  const symToId = new Map(events.map((e) => [sym(e.id), e.id]));
  const causal = edges.filter((e) => e.type !== "contradicts");

  const L: string[] = [];
  for (const e of events) {
    const isAnswer = e.type === "Outcome" || e.actOrd === 12;
    L.push(`event(${sym(e.id)}).`);
    const y = yearOf(e.storyTime);
    if (y != null) L.push(`time(${sym(e.id)}, ${y}).`);
    // 可见起点 = 游戏中揭示给玩家、且不是谜底本身（谜底要被"推出"，不能自证）
    if (e.actOrd != null && !isAnswer) L.push(`observable(${sym(e.id)}).`);
    if (isAnswer) L.push(`answer(${sym(e.id)}).`);
  }
  for (const ed of causal) L.push(`causal(${sym(ed.from)}, ${sym(ed.to)}).`);
  L.push(`paradox(A,B) :- causal(A,B), time(A,TA), time(B,TB), TA > TB.`);
  L.push(`derivable(E) :- observable(E).`);
  L.push(`derivable(E) :- causal(P,E), derivable(P).`);
  L.push(`unsolvable(E) :- answer(E), not derivable(E).`);
  L.push(`#show paradox/2. #show unsolvable/1.`);

  let atoms: string[] = [];
  let solver = "clingo";
  try {
    const res: any = await (clingo as any).run(L.join("\n"), 1);
    solver = res?.Solver ?? "clingo";
    atoms = res?.Call?.[0]?.Witnesses?.[0]?.Value ?? [];
  } catch (e) {
    return { findings: [], solver: "clingo(失败)", temporal: 0, unsolvable: 0 };
  }

  const findings: Finding[] = [];
  let temporal = 0, unsolvable = 0;
  for (const a of atoms) {
    let m: RegExpMatchArray | null;
    if ((m = a.match(/^paradox\((\w+),(\w+)\)$/))) {
      const A = symToId.get(m[1]), B = symToId.get(m[2]);
      if (A && B) { temporal++; findings.push({ id: `tpar-${A}-${B}`, type: "temporal", severity: "error", bySolver: true, title: "时序悖论（因晚于果）", detail: `「${byId.get(A)?.title}」(${byId.get(A)?.storyTime}) 因果指向「${byId.get(B)?.title}」(${byId.get(B)?.storyTime})，但前者时间更晚——因果倒置`, events: [A, B] }); }
    } else if ((m = a.match(/^unsolvable\((\w+)\)$/))) {
      const E = symToId.get(m[1]);
      if (E) { unsolvable++; findings.push({ id: `unsolv-${E}`, type: "unsolvable", severity: "warn", bySolver: true, title: "谜底不可达（玩家推不到）", detail: `「${byId.get(E)?.title}」无法从任何"玩家可见事件"经因果链推导出来`, events: [E] }); }
    }
  }
  return { findings, solver, temporal, unsolvable };
}
