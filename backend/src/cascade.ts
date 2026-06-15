/**
 * P4b · 下游连锁改写：作者改了一处（插入/删除/改写），由 LLM 编剧判断**哪些下游剧情需要跟着改**，
 * 逐个给出 keep / rewrite（新摘要+新结果+理由）/ drop（前因已不成立，建议删）的提议。
 * 分工铁律：LLM 只【提议怎么改】；接受后由确定性引擎 + clingo 求解器重新盖章（/preview）。
 */
import { loadStory } from "./story.js";
import { applyDelta, type EditDelta } from "./preview.js";
import { callDeepSeek } from "./chat.js";
import type { StoryGraph } from "@liumang/shared";

export interface CascadeRewrite {
  id: string;
  title: string;
  action: "keep" | "rewrite" | "drop";
  newSummary?: string;
  newEffect?: string;
  reason: string;
}

/** 下游波及：从改动种子出发，沿因果（非矛盾）边向下游 BFS。在 cur(+新增边) 上算，再剔除已被删/本身是种子的。 */
function downstreamAffected(cur: StoryGraph, d: EditDelta, modifiedIds: Set<string>): string[] {
  const adj = new Map<string, string[]>();
  for (const e of cur.events) adj.set(e.id, []);
  for (const e of d.addEvents ?? []) adj.set(e.id, []);
  for (const ed of [...cur.edges, ...(d.addEdges ?? [])]) if (ed.type !== "contradicts") adj.get(ed.from)?.push(ed.to);
  const seeds = [
    ...(d.removeEventIds ?? []),
    ...(d.addEvents ?? []).map((e) => e.id),
    ...(d.removeEdges ?? []).map((r) => r.to),
    ...(d.updateEvents ?? []).map((u) => u.id),
  ];
  const seen = new Set<string>(seeds);
  let frontier = [...seeds];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) for (const nb of adj.get(id) ?? []) if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
    frontier = next;
  }
  seeds.forEach((s) => seen.delete(s));
  // 只保留改动后仍存在的节点（不提议改写一个被删掉的）
  return [...seen].filter((id) => modifiedIds.has(id));
}

/** 把这次改动描述成人话，喂给编剧 LLM 当上下文 */
function describeChange(cur: StoryGraph, d: EditDelta): string[] {
  const byId = new Map(cur.events.map((e) => [e.id, e]));
  const lines: string[] = [];
  for (const e of d.addEvents ?? []) lines.push(`插入新事件「${e.title}」：${e.summary ?? ""}`);
  for (const id of d.removeEventIds ?? []) lines.push(`删除事件「${byId.get(id)?.title ?? id}」`);
  for (const r of d.removeEdges ?? []) lines.push(`删除因果：「${byId.get(r.from)?.title ?? r.from}」→「${byId.get(r.to)?.title ?? r.to}」`);
  for (const u of d.updateEvents ?? []) {
    const o = byId.get(u.id);
    const parts: string[] = [];
    if (u.patch.title && u.patch.title !== o?.title) parts.push(`标题→「${u.patch.title}」`);
    if (u.patch.summary && u.patch.summary !== o?.summary) parts.push(`摘要→「${u.patch.summary}」`);
    if ((u.patch as any).effect) parts.push(`结果→「${(u.patch as any).effect}」`);
    lines.push(`改写事件「${o?.title ?? u.id}」：${parts.join("；") || "内容微调"}`);
  }
  return lines;
}

/** 只算"哪些下游受影响"（确定性，无 LLM、无上限）——前端拿它分批喂给 LLM、增量显示 */
export function cascadeScope(body: EditDelta & { applied?: EditDelta }): { affected: string[] } {
  const { applied, ...delta } = body;
  const base = loadStory();
  const cur = applied ? applyDelta(base, applied) : base;
  const modified = applyDelta(cur, delta);
  const modIds = new Set(modified.events.map((e) => e.id));
  return { affected: downstreamAffected(cur, delta, modIds) };
}

export async function cascadeRewrite(body: EditDelta & { applied?: EditDelta; onlyIds?: string[] }): Promise<{ affected: string[]; rewrites: CascadeRewrite[]; capped?: number }> {
  const { applied, onlyIds, ...delta } = body;
  const base = loadStory();
  const cur = applied ? applyDelta(base, applied) : base;
  const modified = applyDelta(cur, delta);
  const modIds = new Set(modified.events.map((e) => e.id));
  const byMod = new Map(modified.events.map((e) => [e.id, e]));

  let affected = downstreamAffected(cur, delta, modIds);
  let capped: number | undefined;
  if (onlyIds) {
    // 前端分批：只分析这一批（不设上限）
    const set = new Set(onlyIds);
    affected = affected.filter((id) => set.has(id));
  } else {
    // 直接整体调用（兜底）：留个较高的安全上限，避免单次 prompt 过长
    const CAP = 14;
    capped = affected.length > CAP ? affected.length : undefined;
    affected = affected.slice(0, CAP);
  }
  if (!affected.length) return { affected: [], rewrites: [] };

  const changeLines = describeChange(cur, delta);
  const byCur = new Map(cur.events.map((e) => [e.id, e]));
  const parentsOf = (g: StoryGraph, byId: Map<string, any>, id: string) =>
    g.edges.filter((ed) => ed.to === id && ed.type !== "contradicts").map((ed) => ({ id: ed.from, title: byId.get(ed.from)?.title ?? ed.from }));
  // 每个受影响节点：现状 + 改动前/后的直接前因对比 + 失去的前因（给 LLM 判断依据）
  const nodeBlocks = affected.map((id, i) => {
    const e = byMod.get(id)!;
    const before = parentsOf(cur, byCur, id);
    const after = parentsOf(modified, byMod, id);
    const afterIds = new Set(after.map((p) => p.id));
    const lost = before.filter((p) => !afterIds.has(p.id));
    return [
      `${i + 1}. [${id}]「${e.title}」`,
      `   现摘要：${e.summary ?? "（无）"}`,
      (e as any).effect ? `   现结果：${(e as any).effect}` : ``,
      `   改动后的直接前因：${after.length ? after.map((p) => `「${p.title}」`).join("、") : "（已无前因——成了孤儿事件！）"}`,
      lost.length ? `   ⚠ 因本次改动而失去的前因：${lost.map((p) => `「${p.title}」`).join("、")}` : ``,
    ].filter(Boolean).join("\n");
  });

  const sys = [
    `你是《流氓叙事》剧本杀的资深编剧，正在维护一张因果叙事图。作者刚改动了一处，你要判断**哪些下游剧情需要跟着改**，让因果保持连贯、不自相矛盾。`,
    ``,
    `【作者这次的改动】`,
    ...changeLines.map((l) => `- ${l}`),
    ``,
    `【可能受影响的下游事件】（已按因果顺序，含改动后的直接前因）`,
    ...nodeBlocks,
    ``,
    `对**每一个**上面的事件，三选一：`,
    `- keep：它有别的前因支撑、或与改动无实质关系，无需改。`,
    `- rewrite：它的前提被动摇但仍能成立——调整摘要/结果以保持连贯。给 newSummary（一句话新摘要）、newEffect（可省）、reason（一句话）。`,
    `- drop：它的**关键前因已被删除/改到不再成立**（尤其标了"⚠ 失去的前因"或"成了孤儿"的），剧情已说不通——建议删除，给 reason。`,
    `判断要点：把每个事件的"现摘要"和它"改动后的直接前因"对照——若摘要里的前提（如"电台争夺""挑火"）与改后的前因（如"两族和平共建电台·和解"）直接矛盾，就必须 rewrite 或 drop，别放过；标了"⚠失去的前因/孤儿"的尤其要查。但有独立前因撑住、与改动无关的就老实 keep，别为改而改。贴合《流氓叙事》世界观（莱诺家族阴谋／布雷诺两族／怒河复仇／受控燃烧）。`,
    ``,
    `请**先逐条极简分析**（每条≤25字：前提被改后还说不说得通），分析完，最后再输出 JSON（结尾、单独成段、必须完整闭合）：`,
    `{"rewrites":[{"id":"Exxx","action":"keep|rewrite|drop","newSummary":"...","newEffect":"...","reason":"..."}]}`,
  ].join("\n");

  const out = await callDeepSeek(sys, [{ role: "user", content: `请先逐条极简分析这 ${affected.length} 个下游事件，再在结尾输出完整 JSON。` }], { maxTokens: 3200, temperature: 0.5 });
  try {
    // 稳健提取结尾 JSON（前面允许有分析文字）：定位最后一个 "rewrites" 所在的对象
    const ri = out.lastIndexOf('"rewrites"');
    const start = ri >= 0 ? out.lastIndexOf("{", ri) : out.indexOf("{");
    const end = out.lastIndexOf("}");
    const j = JSON.parse(out.slice(start, end + 1));
    const valid = new Set(affected);
    const rewrites: CascadeRewrite[] = (j.rewrites ?? [])
      .filter((r: any) => valid.has(r.id))
      .map((r: any) => ({
        id: String(r.id),
        title: byMod.get(String(r.id))?.title ?? String(r.id),
        action: ["keep", "rewrite", "drop"].includes(r.action) ? r.action : "keep",
        newSummary: r.newSummary ? String(r.newSummary).slice(0, 160) : undefined,
        newEffect: r.newEffect ? String(r.newEffect).slice(0, 160) : undefined,
        reason: String(r.reason ?? "").slice(0, 160),
      }));
    // 补齐 LLM 漏掉的节点为 keep
    for (const id of affected) if (!rewrites.some((r) => r.id === id)) rewrites.push({ id, title: byMod.get(id)?.title ?? id, action: "keep", reason: "（未判定，默认保留）" });
    return { affected, rewrites, capped };
  } catch {
    return { affected, rewrites: affected.map((id) => ({ id, title: byMod.get(id)?.title ?? id, action: "keep" as const, reason: "（解析失败，默认保留）" })), capped };
  }
}
