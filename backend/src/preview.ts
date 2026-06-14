/**
 * P4 改本预览：把"草稿编辑(delta)"应用到故事图副本（绝不动磁盘），
 * 跑 确定性体检 + clingo 求解器，返回 before→after 的 diff（新增/消除的问题）。
 * 草稿只在请求内存里，不持久化。
 */
import { loadStory } from "./story.js";
import { auditStory } from "./audit.js";
import { solveStory } from "./solver.js";
import type { StoryGraph, StoryEvent, StoryEdge } from "@liumang/shared";

export interface EditDelta {
  addEvents?: StoryEvent[];
  addEdges?: StoryEdge[];
  removeEventIds?: string[];
  removeEdges?: { from: string; to: string }[];
  updateEvents?: { id: string; patch: Partial<StoryEvent> }[];
}

export function applyDelta(base: StoryGraph, d: EditDelta): StoryGraph {
  const rmEv = new Set(d.removeEventIds ?? []);
  const rmEd = d.removeEdges ?? [];
  const patch = new Map((d.updateEvents ?? []).map((u) => [u.id, u.patch]));
  const isRmEd = (e: { from: string; to: string }) => rmEd.some((r) => r.from === e.from && r.to === e.to);
  const events = base.events
    .filter((e) => !rmEv.has(e.id))
    .concat(((d.addEvents ?? []) as StoryEvent[]).filter((e) => !rmEv.has(e.id)))
    .map((e) => (patch.has(e.id) ? { ...e, ...patch.get(e.id) } : e));
  const evIds = new Set(events.map((e) => e.id));
  const edges = [...base.edges, ...((d.addEdges ?? []) as StoryEdge[])]
    .filter((e) => evIds.has(e.from) && evIds.has(e.to)) // 端点必须存在（自动清悬空边）
    .filter((e) => !isRmEd(e));
  return { ...base, events, edges };
}

async function fullAudit(story: StoryGraph) {
  const a = auditStory(story);
  const s = await solveStory(story);
  return {
    findings: [...a.findings, ...s.findings],
    stats: { ...a.stats, temporal: s.temporal, unsolvable: s.unsolvable },
  };
}

export async function previewEdit(body: EditDelta & { applied?: EditDelta }) {
  const { applied, ...delta } = body;
  const base = loadStory();
  // 基线 = 原图 + 本会话已应用的改动（叠加编辑时 before 才正确）；再叠加这次草稿 = after
  const cur = applied ? applyDelta(base, applied) : base;
  const modified = applyDelta(cur, delta);
  const before = await fullAudit(cur);
  const after = await fullAudit(modified);
  const beforeIds = new Set(before.findings.map((f) => f.id));
  const afterIds = new Set(after.findings.map((f) => f.id));
  return {
    before: before.stats,
    after: { stats: after.stats, findings: after.findings },
    added: after.findings.filter((f) => !beforeIds.has(f.id)), // 你制造的新问题
    cleared: before.findings.filter((f) => !afterIds.has(f.id)), // 你修好的问题
  };
}
