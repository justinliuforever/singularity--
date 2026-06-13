import { forceSimulation, forceManyBody, forceLink, forceCollide, forceX, forceY } from "d3-force";
import type { Graph } from "@liumang/shared";

export type Positions = Record<string, { x: number; y: number }>;

/** 一次性力导向布局：用 KNOWS/REL/REVEALS 把知识聚到角色周围；位置稳定（切幕/视角不跳动） */
export function computeLayout(g: Graph): Positions {
  const nodes = g.nodes.map((n) => ({ id: n.id, kind: n.kind, x: 0, y: 0 }));
  const idset = new Set(nodes.map((n) => n.id));
  const links = g.edges
    .filter((e) => ["KNOWS", "BELIEVES_FALSELY", "REL", "REVEALS"].includes(e.kind))
    .filter((e) => idset.has(e.source) && idset.has(e.target))
    .map((e) => ({ source: e.source, target: e.target }));

  const sim = forceSimulation(nodes as any)
    .force("charge", forceManyBody().strength(-160))
    .force(
      "link",
      forceLink(links as any)
        .id((d: any) => d.id)
        .distance(90)
        .strength(0.25)
    )
    .force("x", forceX(0).strength(0.03))
    .force("y", forceY(0).strength(0.03))
    .force("collide", forceCollide(34))
    .stop();

  for (let i = 0; i < 320; i++) sim.tick();

  const pos: Positions = {};
  for (const n of nodes as any) pos[n.id] = { x: (n.x ?? 0) * 1.7, y: (n.y ?? 0) * 1.7 };
  return pos;
}
