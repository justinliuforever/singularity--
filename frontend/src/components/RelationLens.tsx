import { useMemo } from "react";
import { ReactFlow, Background, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Graph } from "@liumang/shared";
import { useUI } from "../store";

export default function RelationLens({ graph, draftNames }: { graph: Graph; draftNames?: Set<string> }) {
  const { perspective, hoverChar, set, enterChar } = useUI();
  const isDraft = (c: string) => !!draftNames?.has(c);

  const roleOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of graph.nodes) if (n.kind === "character") m.set(n.id, n.role ?? "NPC");
    return m;
  }, [graph]);
  const isPC = (c: string) => roleOf.get(c) === "PC";

  // 只保留"至少一端是 PC"的关系边（去掉 NPC-NPC 噪声），去重无向对
  const { relEdges, pcs, npcs } = useMemo(() => {
    const seen = new Map<string, { source: string; target: string; label: string }>();
    for (const e of graph.edges) {
      if (e.kind !== "REL") continue;
      // 保留：至少一端是 PC（去 NPC-NPC 噪声）——但本会话新角色的全部关系都留，让 ta 成为真正的枢纽
      if (roleOf.get(e.source) !== "PC" && roleOf.get(e.target) !== "PC" && !isDraft(e.source) && !isDraft(e.target)) continue;
      const key = [e.source, e.target].sort().join("|");
      if (!seen.has(key)) seen.set(key, { source: e.source, target: e.target, label: e.relType || e.label || "" });
    }
    const rel = [...seen.values()];
    const nodes = new Set<string>();
    for (const e of rel) {
      nodes.add(e.source);
      nodes.add(e.target);
    }
    const pcs = [...nodes].filter((c) => roleOf.get(c) === "PC").sort();
    const npcs = [...nodes].filter((c) => roleOf.get(c) !== "PC");
    return { relEdges: rel, pcs, npcs };
  }, [graph, roleOf, draftNames]);

  const focus = perspective !== "god" ? perspective : hoverChar;
  const neighbors = useMemo(() => {
    if (!focus) return null;
    const s = new Set<string>([focus]);
    for (const e of relEdges) {
      if (e.source === focus) s.add(e.target);
      if (e.target === focus) s.add(e.source);
    }
    return s;
  }, [focus, relEdges]);

  const nodes: Node[] = useMemo(() => {
    const R = Math.max(280, (pcs.length + npcs.length) * 14);
    const cx = R;
    const cy = R;
    const pcAngle = new Map(pcs.map((c, i) => [c, -Math.PI / 2 + (i / Math.max(1, pcs.length)) * Math.PI * 2]));
    // NPC 锚定角 = 所连 PC 的平均方向 → 按锚角排序，外圈均匀铺开（同一 PC 的 NPC 相邻，减少交叉）
    const anchor = (c: string) => {
      let sx = 0,
        sy = 0,
        n = 0;
      for (const e of relEdges) {
        const other = e.source === c ? e.target : e.target === c ? e.source : null;
        if (other && pcAngle.has(other)) {
          const a = pcAngle.get(other)!;
          sx += Math.cos(a);
          sy += Math.sin(a);
          n++;
        }
      }
      return n ? Math.atan2(sy, sx) : 0;
    };
    const npcSorted = [...npcs].sort((a, b) => anchor(a) - anchor(b));

    const mk = (c: string, x: number, y: number): Node => {
      const pc = isPC(c);
      const draft = isDraft(c);
      const dim = neighbors ? !neighbors.has(c) : false;
      const isFocus = c === focus;
      return {
        id: c,
        position: { x, y },
        data: { label: draft ? `＋${c}` : c },
        style: {
          width: pc ? 92 : 72,
          fontSize: pc ? 11 : 10,
          padding: "5px 4px",
          borderRadius: 999,
          border: isFocus ? "2px solid #fb7185" : draft ? "1.5px dashed #34d399" : pc ? "1.5px solid #8b5cf6" : "1px solid #3a3e4f",
          background: draft ? "rgba(52,211,153,0.16)" : pc ? "rgba(139,92,246,0.18)" : "#15161d",
          color: dim ? "#52525b" : draft ? "#a7f3d0" : pc ? "#ddd6fe" : "#a1a1aa",
          opacity: dim ? 0.3 : 1,
          boxShadow: isFocus ? "0 0 0 5px rgba(251,113,133,0.16)" : draft ? "0 0 0 4px rgba(52,211,153,0.12)" : "none",
          textAlign: "center" as const,
        },
      };
    };

    const inner = pcs.map((c) => {
      const a = pcAngle.get(c)!;
      return mk(c, cx + Math.cos(a) * R * 0.4, cy + Math.sin(a) * R * 0.4);
    });
    const outer = npcSorted.map((c, i) => {
      const a = -Math.PI / 2 + (i / Math.max(1, npcSorted.length)) * Math.PI * 2;
      return mk(c, cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95);
    });
    return [...inner, ...outer];
  }, [pcs, npcs, relEdges, neighbors, focus]);

  const edges: Edge[] = useMemo(
    () =>
      relEdges.map((e, i) => {
        const visible = !neighbors || (neighbors.has(e.source) && neighbors.has(e.target));
        const hot = !!focus && (e.source === focus || e.target === focus);
        return {
          id: `rel-${i}`,
          source: e.source,
          target: e.target,
          label: hot || (focus && visible) ? e.label : "",
          animated: hot,
          style: { stroke: hot ? "#fb7185" : "#3a3e4f", strokeWidth: hot ? 1.8 : 1, opacity: visible ? (hot ? 1 : 0.4) : 0.08 },
          labelStyle: { fill: "#a1a1aa", fontSize: 9 },
          labelBgStyle: { fill: "#0f1015" },
        };
      }),
    [relEdges, neighbors, focus]
  );

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute right-4 top-3 z-10 text-[10px] text-zinc-600">
        内圈 <span className="text-accent-soft">PC</span> · 外圈 NPC · 悬停/点击聚焦 TA 的关系
        {draftNames && draftNames.size > 0 && <span className="ml-1.5 rounded bg-emerald-500/15 px-1 py-0.5 text-emerald-300">＋ 本会话新增 {draftNames.size} 人（虚线）</span>}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.2}
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, n) => {
          if (isPC(n.id)) enterChar(n.id);
        }}
        onNodeMouseEnter={(_, n) => set({ hoverChar: n.id })}
        onNodeMouseLeave={() => set({ hoverChar: null })}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1b1d26" gap={22} />
      </ReactFlow>
    </div>
  );
}
