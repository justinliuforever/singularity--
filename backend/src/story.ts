/**
 * 创作画布 · 故事图编译：读 08_story/{events,causal_edges}.yaml → StoryGraph。
 * 事件层(fabula) + 因果边。每事件带 actOrd(幕序，X轴) 与 actors(泳道归属)。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { StoryGraph, StoryEvent, StoryEdge } from "@liumang/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DIG = path.join(ROOT, "digitized", "流氓叙事");
const STORY = path.join(DIG, "08_story");

const ACT_ORD: Record<string, number> = {
  开本前准备: 0, 序幕: 1, 第一幕: 2, 第二幕: 3, 第三幕: 4, 第四幕: 5, 第五幕: 6,
  第六幕: 7, 第七幕: 8, 无声之旅: 9, 无所容心: 10, 第十幕: 11, 结局演绎剧场: 12, 结局: 12,
};
const ACTS = [
  { ord: 1, name: "序幕" }, { ord: 2, name: "第一幕" }, { ord: 3, name: "第二幕" },
  { ord: 4, name: "第三幕" }, { ord: 5, name: "第四幕" }, { ord: 6, name: "第五幕" },
  { ord: 7, name: "第六幕" }, { ord: 8, name: "第七幕" }, { ord: 9, name: "无声之旅" },
  { ord: 10, name: "无所容心" }, { ord: 11, name: "第十幕" }, { ord: 12, name: "结局演绎剧场" },
];
function actOrdOf(name: string | null): number | null {
  if (!name) return null;
  const k = name.trim();
  if (ACT_ORD[k] != null) return ACT_ORD[k];
  for (const key of Object.keys(ACT_ORD)) if (key.includes(k) || k.includes(key)) return ACT_ORD[key];
  return null;
}

const PCS = new Set(["程聿怀", "程走柳", "缪宏谟", "黛利拉", "以撒", "蒋伯驾"]);

const read = (p: string) => fs.readFileSync(p, "utf8").replace(/^﻿/, "");

let CACHE: StoryGraph | null = null;

export function loadStory(): StoryGraph {
  if (CACHE) return CACHE;
  const rawEv = (parse(read(path.join(STORY, "events.yaml"))) as any)?.events ?? [];
  const rawEd = (parse(read(path.join(STORY, "causal_edges.yaml"))) as any)?.edges ?? [];

  const events: StoryEvent[] = rawEv.map((e: any) => ({
    id: String(e.id),
    type: e.type ?? "Event",
    title: e.title ?? "",
    summary: e.summary ?? "",
    storyTime: String(e.story_time ?? e.storyTime ?? ""),
    act: e.act ?? null,
    actOrd: actOrdOf(e.act ?? null),
    actors: Array.isArray(e.actors)
      ? e.actors.map((a: any) => (typeof a === "string" ? { char: a, role: "agent" } : { char: a.char, role: a.role ?? "agent" }))
      : [],
    facts: Array.isArray(e.facts) ? e.facts.map(String) : [],
    motive: e.motive ?? "",
    effect: e.effect ?? "",
  }));

  const ids = new Set(events.map((e) => e.id));
  const edges: StoryEdge[] = rawEd
    .map((e: any) => ({ from: String(e.from), to: String(e.to), type: e.type ?? "causes", note: e.note ?? "" }))
    .filter((e: StoryEdge) => ids.has(e.from) && ids.has(e.to)); // 去悬空

  // cast：出场角色按事件数降序
  const counts = new Map<string, number>();
  for (const ev of events) for (const a of ev.actors) counts.set(a.char, (counts.get(a.char) ?? 0) + 1);
  const cast = [...counts.entries()]
    .map(([char, count]) => ({ char, count, isPC: PCS.has(char) }))
    .sort((a, b) => Number(b.isPC) - Number(a.isPC) || b.count - a.count);

  CACHE = { events, edges, cast, acts: ACTS };
  return CACHE;
}
