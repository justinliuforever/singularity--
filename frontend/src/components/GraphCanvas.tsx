import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  BackgroundVariant,
} from "@xyflow/react";
import type { Graph, GraphNode, NodeState } from "@liumang/shared";
import type { Slice } from "@liumang/shared";
import type { Positions } from "../lib/layout";

interface NodeData extends Record<string, unknown> {
  node: GraphNode;
  state: NodeState;
  isPerspective: boolean;
  isFalseBelief: boolean;
  selected: boolean;
}

const stateClass = (s: NodeState) =>
  s === "full" ? "opacity-100" : s === "dim" ? "opacity-40" : "opacity-[0.07] grayscale blur-[0.5px]";

function CharacterNode({ data }: NodeProps<Node<NodeData>>) {
  const { node, state, isPerspective, selected } = data;
  const pc = node.role === "PC";
  const ring = isPerspective ? "ring-2 ring-accent shadow-[0_0_24px_rgba(139,92,246,0.55)]" : selected ? "ring-2 ring-white/70" : pc ? "ring-1 ring-violet-400/50" : "ring-1 ring-zinc-500/40";
  return (
    <div className={`flex flex-col items-center transition-all ${stateClass(state)}`}>
      <Handle type="target" position={Position.Top} />
      <div className={`h-14 w-14 rounded-full overflow-hidden bg-ink-700 ${ring}`}>
        {node.image ? (
          <img src={node.image} alt={node.label} className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="h-full w-full grid place-items-center text-sm text-zinc-300">{node.label.slice(0, 2)}</div>
        )}
      </div>
      <div className="mt-1 max-w-[88px] truncate text-[11px] text-zinc-200 text-center">{node.label}</div>
      {pc && <div className="text-[8px] text-violet-300/70">PC</div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function FactNode({ data }: NodeProps<Node<NodeData>>) {
  const { node, state, isFalseBelief, selected } = data;
  const referee = node.access === "referee";
  const base = isFalseBelief
    ? "bg-rose-500/15 border-rose-400/70 text-rose-100 lie-pulse"
    : referee
      ? "bg-amber-500/10 border-amber-400/40 text-amber-100/90"
      : "bg-ink-800 border-zinc-600/50 text-zinc-200";
  return (
    <div className={`relative max-w-[150px] rounded-md border px-2 py-1 text-[10px] leading-snug transition-all ${base} ${selected ? "ring-2 ring-white/70" : ""} ${stateClass(state)}`}>
      <Handle type="target" position={Position.Top} />
      {isFalseBelief && <span className="absolute -top-2 -right-2 rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">假</span>}
      {referee && !isFalseBelief && <span className="absolute -top-2 -right-2 text-[9px]">🔒</span>}
      <span className="line-clamp-2">{node.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function ClueNode({ data }: NodeProps<Node<NodeData>>) {
  const { node, state, selected } = data;
  return (
    <div className={`max-w-[130px] rounded-sm border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] text-emerald-100/90 transition-all ${selected ? "ring-2 ring-white/70" : ""} ${stateClass(state)}`}>
      <Handle type="target" position={Position.Top} />
      <span className="line-clamp-2">🃏 {node.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { character: CharacterNode, fact: FactNode, clue: ClueNode };

const edgeStyle: Record<string, { stroke: string; dash?: string; animated?: boolean }> = {
  KNOWS: { stroke: "#3b82f6", dash: "" },
  BELIEVES_FALSELY: { stroke: "#fb7185", dash: "4 3", animated: true },
  MUST_HIDE: { stroke: "#f59e0b", dash: "2 3" },
  REVEALS: { stroke: "#34d399", dash: "5 4" },
  REL: { stroke: "#8b5cf6", dash: "" },
  TRIGGERS: { stroke: "#64748b", dash: "2 4" },
};

export default function GraphCanvas({
  graph,
  slice,
  positions,
  perspective,
  selectedId,
  onSelect,
}: {
  graph: Graph;
  slice: Slice;
  positions: Positions;
  perspective: string;
  selectedId: string | null;
  onSelect: (n: GraphNode | null) => void;
}) {
  const falseBeliefTargets = useMemo(() => {
    const s = new Set<string>();
    for (const e of graph.edges) if (e.kind === "BELIEVES_FALSELY" && e.source === perspective) s.add(e.target);
    return s;
  }, [graph, perspective]);

  const nodes: Node<NodeData>[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: n.kind === "event" ? "fact" : n.kind,
        position: positions[n.id] ?? { x: 0, y: 0 },
        draggable: true,
        data: {
          node: n,
          state: slice.nodeState[n.id] ?? "fog",
          isPerspective: n.id === perspective,
          isFalseBelief: falseBeliefTargets.has(n.id),
          selected: n.id === selectedId,
        },
      })),
    [graph, slice, positions, perspective, selectedId, falseBeliefTargets]
  );

  const edges: Edge[] = useMemo(
    () =>
      graph.edges
        .filter((e) => slice.edgeVisible[e.id])
        .map((e) => {
          const st = edgeStyle[e.kind] ?? { stroke: "#52525b" };
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            animated: !!st.animated,
            style: { stroke: st.stroke, strokeDasharray: st.dash, opacity: 0.7 },
          } as Edge;
        }),
    [graph, slice]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, n) => onSelect((n.data as NodeData).node)}
      onPaneClick={() => onSelect(null)}
      fitView
      minZoom={0.15}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#1b1d26" />
      <Controls className="!bg-ink-800 !border-ink-700 [&>button]:!bg-ink-800 [&>button]:!border-ink-700 [&>button]:!fill-zinc-300" />
    </ReactFlow>
  );
}
