/**
 * A1 · 改本 → 角色认知·影响面（Phase 1 轻量版，纯确定性、零求解器）
 *
 * 改/删/插一个事件后，沿「事件携带的 facts × actors」+「下游因果可达事件」派生出
 * 哪些角色的认知被牵动：谁本来知道这条事实、谁误信它、谁在守它。
 * 复用：cascadeScope（下游因果 BFS）+ 已编译知识图谱（KNOWS / BELIEVES_FALSELY / MUST_HIDE 边）。
 * 不改盘、不调模型——给作者一个"动这一处，会牵动谁的认知"的即时影响面。
 */
import type { Graph, StoryEvent } from "@liumang/shared";
import { loadStory } from "./story.js";
import { applyDelta, type EditDelta } from "./preview.js";
import { cascadeScope } from "./cascade.js";

export type CogRel = "actor" | "knows" | "false" | "hide";

export interface CogFact {
  id: string;
  label: string;
  rel: CogRel;
  eventIds: string[];
}
export interface CharImpact {
  char: string;
  direct: boolean; // 被「直接改的事件」牵动（硬归因）；否则仅经下游因果波及（软）
  roles: string[]; // 在被改事件里的定位（agent/patient/witness/...）
  rels: CogRel[]; // 牵动方式（去重）
  facts: CogFact[]; // 被牵动的事实 + 此人与它的关系
  events: string[]; // 牵动到此人的事件 id
}
export interface CognitionImpact {
  touched: { id: string; title: string; kind: "edited" | "downstream" }[];
  chars: CharImpact[];
  factCount: number;
}

const REL_OF: Record<string, CogRel> = { KNOWS: "knows", BELIEVES_FALSELY: "false", MUST_HIDE: "hide" };

export function cognitionImpact(graph: Graph, body: EditDelta & { applied?: EditDelta }): CognitionImpact {
  const { applied, ...delta } = body;
  const base = loadStory();
  const cur = applied ? applyDelta(base, applied) : base;
  const after = applyDelta(cur, delta);

  // 直接改的种子事件（删/改/插）
  const seed = new Set<string>([
    ...(delta.removeEventIds ?? []),
    ...(delta.updateEvents ?? []).map((u) => u.id),
    ...(delta.addEvents ?? []).map((e) => e.id),
  ]);
  // 下游因果波及（复用现有 BFS），去掉与种子重叠的
  const downstream = cascadeScope(body).affected.filter((id) => !seed.has(id));

  // 事件查表：改后版本优先，被删的回退到改前
  const byId = new Map<string, StoryEvent>();
  for (const e of cur.events) byId.set(e.id, e);
  for (const e of after.events) byId.set(e.id, e);

  const touched: CognitionImpact["touched"] = [];
  for (const id of seed) touched.push({ id, title: byId.get(id)?.title ?? id, kind: "edited" });
  for (const id of downstream) touched.push({ id, title: byId.get(id)?.title ?? id, kind: "downstream" });

  // 图谱索引：fact 标签、真实角色集合、fact→(角色,关系)
  const factLabel = new Map<string, string>();
  const charNodes = new Set<string>();
  for (const n of graph.nodes) {
    if (n.kind === "fact") factLabel.set(n.id, n.label);
    else if (n.kind === "character") charNodes.add(n.id);
  }
  const factToChars = new Map<string, { char: string; rel: CogRel }[]>();
  for (const e of graph.edges) {
    const rel = REL_OF[e.kind];
    if (!rel) continue;
    const arr = factToChars.get(e.target) ?? [];
    arr.push({ char: e.source, rel });
    factToChars.set(e.target, arr);
  }

  // 聚合 char → impact
  const map = new Map<string, CharImpact>();
  const ensure = (char: string): CharImpact => {
    let v = map.get(char);
    if (!v) { v = { char, direct: false, roles: [], rels: [], facts: [], events: [] }; map.set(char, v); }
    return v;
  };

  const factSeen = new Set<string>();
  for (const eid of [...seed, ...downstream]) {
    const ev = byId.get(eid);
    if (!ev) continue;
    const isDirect = seed.has(eid);
    // 直接涉及：事件的 actors（跳过「莱诺家族」这类非角色实体）
    for (const a of ev.actors ?? []) {
      if (!charNodes.has(a.char)) continue;
      const v = ensure(a.char);
      if (isDirect) v.direct = true;
      if (!v.roles.includes(a.role)) v.roles.push(a.role);
      if (!v.rels.includes("actor")) v.rels.push("actor");
      if (!v.events.includes(eid)) v.events.push(eid);
    }
    // 认知牵动：知道/误信/守 这条事实的人
    for (const fid of ev.facts ?? []) {
      factSeen.add(fid);
      for (const { char, rel } of factToChars.get(fid) ?? []) {
        const v = ensure(char);
        if (isDirect) v.direct = true;
        if (!v.rels.includes(rel)) v.rels.push(rel);
        if (!v.events.includes(eid)) v.events.push(eid);
        let cf = v.facts.find((f) => f.id === fid && f.rel === rel);
        if (!cf) { cf = { id: fid, label: factLabel.get(fid) ?? fid, rel, eventIds: [] }; v.facts.push(cf); }
        if (!cf.eventIds.includes(eid)) cf.eventIds.push(eid);
      }
    }
  }

  // 直接牵动优先，再按影响面大小
  const chars = [...map.values()].sort(
    (a, b) => Number(b.direct) - Number(a.direct) || b.facts.length + b.events.length - (a.facts.length + a.events.length),
  );
  return { touched, chars, factCount: factSeen.size };
}
