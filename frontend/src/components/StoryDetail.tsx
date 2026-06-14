import { Fragment, useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Handle, Position, MarkerType, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";
import { ChevronLeft, Undo2, Loader2 } from "lucide-react";
import type { StoryGraph, StoryEvent } from "@liumang/shared";
import { useUI } from "../store";
import StoryMinimap from "./StoryMinimap";

const NODE_W = 236;
const NODE_H = 138;

const TYPE_COLOR: Record<string, string> = {
  Event: "#60a5fa", Decision: "#a78bfa", Lie: "#fb7185", Reveal: "#34d399", RelationChange: "#f59e0b", Outcome: "#22d3ee", Perception: "#94a3b8", Goal: "#c084fc",
};
const TYPE_LABEL: Record<string, string> = { Event: "事件", Decision: "决定", Lie: "谎言", Reveal: "揭露", RelationChange: "关系", Outcome: "结局", Perception: "感知", Goal: "目标" };
const EDGE_COLOR: Record<string, string> = { causes: "#94a3b8", motivates: "#a78bfa", enables: "#64748b", reveals: "#34d399", depends_on: "#f59e0b", contradicts: "#fb7185" };
const EDGE_LABEL: Record<string, string> = { causes: "导致", motivates: "动机", enables: "使能", reveals: "揭示", depends_on: "依赖", contradicts: "矛盾" };

const PCS = new Set(["程聿怀", "程走柳", "缪宏谟", "黛利拉", "以撒", "蒋伯驾"]);
const elk = new ELK();

/** 富卡片节点 */
function StoryCard({ data }: { data: { ev: StoryEvent; role: "spine" | "ctx" } }) {
  const { selEvent, hoverEvent } = useUI();
  const { ev, role } = data;
  const color = TYPE_COLOR[ev.type] ?? "#60a5fa";
  const sel = selEvent === ev.id;
  const hot = hoverEvent === ev.id;
  const ctx = role === "ctx";
  return (
    <div
      className={`relative rounded-xl border bg-ink-850 ${sel ? "border-accent ring-2 ring-accent/40" : hot ? "border-ink-500" : ctx ? "border-dashed border-ink-700" : "border-ink-600"}`}
      style={{ width: NODE_W, height: NODE_H, opacity: ctx ? 0.62 : 1 }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <span className="absolute left-0 top-0 h-full w-1.5 rounded-l-xl" style={{ background: color }} />
      <div className="flex h-full flex-col gap-1 py-2 pl-3.5 pr-2.5">
        <div className="flex items-center gap-1.5 text-[9px]">
          <span className="rounded px-1 py-0.5 font-medium" style={{ background: `${color}22`, color }}>{TYPE_LABEL[ev.type] ?? ev.type}</span>
          {ev.act && <span className="rounded bg-accent/15 px-1 text-accent-soft">{ev.act}</span>}
          {ev.storyTime && <span className="text-zinc-600">{ev.storyTime}</span>}
          {ctx && <span className="ml-auto text-zinc-600">牵连</span>}
        </div>
        <div className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-zinc-100">{ev.title}</div>
        {ev.summary && <div className="line-clamp-2 text-[9.5px] leading-snug text-zinc-500">{ev.summary}</div>}
        <div className="mt-auto flex flex-wrap items-center gap-1 text-[8.5px]">
          {ev.actors.slice(0, 4).map((a) => (
            <span key={a.char} className={`rounded px-1 ${PCS.has(a.char) ? "bg-rose-400/15 text-rose-200" : "bg-ink-700 text-zinc-400"}`}>{a.char}</span>
          ))}
          {ev.facts.length > 0 && <span className="ml-auto text-zinc-600">{ev.facts.length}事实</span>}
        </div>
      </div>
    </div>
  );
}
const nodeTypes = { story: StoryCard };

/** 按载体算因果邻域：保跨角色上下文 */
function computeScope(story: StoryGraph, detail: { kind: string; id: string }) {
  const adj = new Map<string, Set<string>>();
  for (const e of story.events) adj.set(e.id, new Set());
  for (const ed of story.edges) {
    adj.get(ed.from)?.add(ed.to);
    adj.get(ed.to)?.add(ed.from);
  }
  const spine = new Set<string>();
  if (detail.kind === "char") {
    for (const e of story.events) if (e.actors.some((a) => a.char === detail.id)) spine.add(e.id);
  } else if (detail.kind === "act") {
    for (const e of story.events) if (e.act === detail.id) spine.add(e.id);
  } else {
    spine.add(detail.id);
  }
  // 上下文：从 spine 出发的因果邻居（char/act=1跳；event=2跳）
  const depth = detail.kind === "event" ? 2 : 1;
  const all = new Set(spine);
  let frontier = new Set(spine);
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();
    for (const id of frontier) for (const nb of adj.get(id) ?? []) if (!all.has(nb)) { all.add(nb); next.add(nb); }
    frontier = next;
  }
  const byId = new Map(story.events.map((e) => [e.id, e]));
  const nodes = [...all].map((id) => byId.get(id)!).filter(Boolean);
  const edges = story.edges.filter((ed) => all.has(ed.from) && all.has(ed.to));
  return { nodes, edges, spine };
}

export default function StoryDetail({ story, portraitOf = () => null }: { story: StoryGraph; portraitOf?: (c: string) => string | null }) {
  const { detailStack, pickEvent, openDetail, backDetail, jumpDetail } = useUI();
  const detail = detailStack[detailStack.length - 1];
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  const labelOf = (d: { kind: string; id: string }) =>
    d.kind === "event" ? (story.events.find((e) => e.id === d.id)?.title ?? d.id).slice(0, 14) : d.id;

  const scope = useMemo(() => (detail ? computeScope(story, detail) : { nodes: [], edges: [], spine: new Set<string>() }), [story, detail]);
  const scopeIds = useMemo(() => new Set(scope.nodes.map((n) => n.id)), [scope]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const rfNodes: Node[] = scope.nodes.map((ev) => ({
      id: ev.id, type: "story", position: { x: 0, y: 0 },
      data: { ev, role: scope.spine.has(ev.id) ? "spine" : "ctx" },
    }));
    const rfEdges: Edge[] = scope.edges.map((ed, i) => {
      const color = EDGE_COLOR[ed.type] ?? "#475569";
      return {
        id: `e${i}`, source: ed.from, target: ed.to, label: EDGE_LABEL[ed.type] ?? ed.type,
        type: "default", animated: ed.type === "motivates",
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        style: { stroke: color, strokeWidth: 1.4, strokeDasharray: ed.type === "contradicts" ? "5 4" : undefined },
        labelStyle: { fill: "#cbd5e1", fontSize: 9 }, labelBgStyle: { fill: "#0f1015", fillOpacity: 0.85 }, labelBgPadding: [3, 1] as [number, number],
      };
    });
    const g: any = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered", "elk.direction": "RIGHT",
        "elk.layered.spacing.nodeNodeBetweenLayers": "96", "elk.spacing.nodeNode": "30",
        "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      },
      children: rfNodes.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
      edges: rfEdges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
    };
    elk.layout(g).then((res: any) => {
      if (!live) return;
      const posById = new Map((res.children ?? []).map((c: any) => [c.id, { x: c.x, y: c.y }]));
      setNodes(rfNodes.map((n) => ({ ...n, position: (posById.get(n.id) as any) ?? { x: 0, y: 0 } })));
      setEdges(rfEdges);
      setLoading(false);
    }).catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [scope]);

  if (!detail) return null;
  const kindLabel = detail.kind === "char" ? "故事线详图" : detail.kind === "act" ? "因果切面" : "因果邻域";

  return (
    <div className="relative h-full w-full bg-ink-950">
      {/* 顶部：返回上一步 + 面包屑栈 */}
      <div className="absolute left-3 top-3 z-10 flex max-w-[78%] items-center gap-2">
        <button
          onClick={backDetail}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-ink-700 bg-ink-900/90 px-2.5 py-1.5 text-[11px] text-zinc-300 backdrop-blur transition-colors hover:border-accent/60 hover:text-white"
          title="返回上一步"
        >
          <Undo2 size={13} /> 上一步
        </button>
        <div className="flex min-w-0 items-center gap-1 overflow-hidden rounded-lg border border-ink-700 bg-ink-900/90 px-2.5 py-1.5 text-[11px] backdrop-blur">
          <button onClick={() => jumpDetail(-1)} className="shrink-0 text-zinc-400 transition-colors hover:text-white">总览</button>
          {detailStack.map((d, i) => {
            const cur = i === detailStack.length - 1;
            return (
              <Fragment key={i}>
                <ChevronLeft size={11} className="shrink-0 rotate-180 text-zinc-600" />
                <button onClick={() => jumpDetail(i)} className={`max-w-[150px] truncate ${cur ? "font-semibold text-accent-soft" : "text-zinc-400 hover:text-zinc-100"}`}>{labelOf(d)}</button>
              </Fragment>
            );
          })}
          <span className="shrink-0 pl-1 text-zinc-600">· {kindLabel} · {scope.nodes.length}事件/{scope.edges.length}因果</span>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/60">
          <div className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 size={15} className="animate-spin" />分层布局中…</div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.16 }}
        minZoom={0.2}
        maxZoom={1.6}
        nodesDraggable
        nodesConnectable={false}
        onNodeClick={(_, n) => pickEvent(n.id)}
        onNodeDoubleClick={(_, n) => openDetail("event", n.id)}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1b1d26" gap={24} />
      </ReactFlow>

      {/* 右下：你在这里 · 故事全景 minimap */}
      <div className="absolute bottom-3 right-3 z-10">
        <StoryMinimap story={story} highlight={scopeIds} caption={`${kindLabel}：${labelOf(detail)}`} portraitOf={portraitOf} />
      </div>
    </div>
  );
}
