import type { StoryGraph } from "@liumang/shared";
import type { Draft } from "../store";

/** 把草稿(增/删事件与边)应用到故事图，得到"生效后"的图。端点不存在的边自动剔除。 */
export function applyDraft(story: StoryGraph, d: Draft): StoryGraph {
  if (!d.addEvents.length && !d.addEdges.length && !d.removeEventIds.length && !d.removeEdges.length) return story;
  const rmEv = new Set(d.removeEventIds);
  const events = story.events.filter((e) => !rmEv.has(e.id)).concat(d.addEvents.filter((e) => !rmEv.has(e.id)));
  const evIds = new Set(events.map((e) => e.id));
  const isRm = (e: { from: string; to: string }) => d.removeEdges.some((r) => r.from === e.from && r.to === e.to);
  const edges = [...story.edges, ...d.addEdges].filter((e) => evIds.has(e.from) && evIds.has(e.to)).filter((e) => !isRm(e));
  return { ...story, events, edges };
}
