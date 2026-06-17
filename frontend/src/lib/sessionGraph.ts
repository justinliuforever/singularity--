import type { Graph, GraphNode, GraphEdge, StoryEvent, StoryEdge } from "@liumang/shared";
import type { CharDraft } from "./api";

/**
 * B1 · 把本会话采纳的新角色注入图谱副本：加 character 节点 + ✓关系的 REL 边。
 * 绝不动原图（与 applyDraft 同理，刷新即还原）。返回 draftNames 供关系网把新角色标成"草稿"。
 */
export function injectSessionChars(graph: Graph, chars: CharDraft[]): { graph: Graph; draftNames: Set<string> } {
  const draftNames = new Set<string>();
  if (!chars.length) return { graph, draftNames };
  const existing = new Set(graph.nodes.filter((n) => n.kind === "character").map((n) => n.id));
  const nodes: GraphNode[] = [...graph.nodes];
  const edges: GraphEdge[] = [...graph.edges];
  for (const c of chars) {
    if (existing.has(c.name) || draftNames.has(c.name)) continue; // 重名跳过，避免重复节点 id
    draftNames.add(c.name);
    nodes.push({ id: c.name, kind: "character", label: c.name, act: null, role: "NPC", image: null });
    c.relations.forEach((r, i) => {
      if (!r.exists || !existing.has(r.target)) return; // 只连在册真人
      edges.push({ id: `sess-${c.name}-${i}`, source: c.name, target: r.target, kind: "REL", act: null, perspective: c.name, relType: r.type, label: r.type, subjective: true });
    });
  }
  return { graph: { ...graph, nodes, edges }, draftNames };
}

/**
 * 把本会话采纳的新角色的剧情事件，转成故事图草稿（addEvents + addEdges）→ 注入 eStory，
 * 直接渲染进上帝·创作的故事图。新角色为 agent、同场角色为 witness；afterId→causes 边、leadsToId→enables 边。
 * 返回 newEventIds 供画布把这些事件标成"新角色剧情"。
 */
export function charsToStoryDraft(
  chars: CharDraft[],
  existingEventIds: Set<string>,
): { addEvents: StoryEvent[]; addEdges: StoryEdge[]; newEventIds: Set<string> } {
  const addEvents: StoryEvent[] = [];
  const addEdges: StoryEdge[] = [];
  const newEventIds = new Set<string>();
  for (const c of chars) {
    for (const se of c.storyEvents ?? []) {
      if (newEventIds.has(se.id) || existingEventIds.has(se.id)) continue;
      newEventIds.add(se.id);
      addEvents.push({
        id: se.id,
        type: se.type || "Event",
        title: se.title,
        summary: se.summary,
        storyTime: "",
        act: se.actOk ? se.act : null,
        actOrd: se.actOrd,
        actors: [{ char: c.name, role: "agent" }, ...se.withChars.map((w) => ({ char: w, role: "witness" }))],
        facts: [],
        motive: se.motive,
        effect: se.effect,
      });
    }
  }
  // 端点都存在才连边（避免悬空）
  const allIds = new Set<string>([...existingEventIds, ...newEventIds]);
  for (const c of chars) {
    for (const se of c.storyEvents ?? []) {
      if (se.afterId && allIds.has(se.afterId)) addEdges.push({ from: se.afterId, to: se.id, type: "causes", note: `${c.name}·${se.title}` });
      if (se.leadsToId && allIds.has(se.leadsToId)) addEdges.push({ from: se.id, to: se.leadsToId, type: "enables", note: `${c.name}·${se.title}` });
    }
  }
  return { addEvents, addEdges, newEventIds };
}
