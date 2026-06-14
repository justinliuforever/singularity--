import { Fragment, useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Handle, Position, MarkerType, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";
import { ChevronLeft, Undo2, Loader2, Zap, Search, Network, RotateCcw, AlertTriangle, Pencil, Trash2, Sparkles } from "lucide-react";
import type { StoryGraph, StoryEvent } from "@liumang/shared";
import { useUI, type EventMode } from "../store";
import { postPreview } from "../lib/api";
import StoryMinimap from "./StoryMinimap";
import EditHUD from "./EditHUD";
import InsertPanel from "./InsertPanel";
import EditNodePanel from "./EditNodePanel";
import CascadeDrawer from "./CascadeDrawer";

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

type Side = "origin" | "up" | "down";
interface NodeData { ev: StoryEvent; role?: "spine" | "ctx"; side?: Side; layer?: number; sideMax?: number; mode?: EventMode; origin?: boolean; affected?: boolean }

/** 富卡片节点：锚点(焦点)/选中/三模式激活态/改本草稿态 */
function StoryCard({ data }: { data: NodeData }) {
  const { selEvent, hoverEvent, propLevel, flagged, editing, draft } = useUI();
  const { ev, role, side, layer = 0, sideMax = 0, mode, origin, affected } = data;
  const flag = flagged[ev.id];
  const removed = editing && draft.removeEventIds.includes(ev.id);
  const isNew = editing && draft.addEvents.some((e) => e.id === ev.id);
  const edited = editing && draft.updateEvents.some((u) => u.id === ev.id);
  const color = TYPE_COLOR[ev.type] ?? "#60a5fa";
  const sel = selEvent === ev.id;
  const hot = hoverEvent === ev.id;

  let border = "border-ink-600";
  let glow: string | undefined;
  let opacity = 1;
  let wavePulse = false;
  let badge: { text: string; bg: string } | null = null;

  if (mode === "blast") {
    if (origin) { border = "border-rose-400"; glow = "0 0 0 2px #fb7185, 0 0 18px #fb718577"; badge = { text: "改动源 · 焦点", bg: "#fb7185" }; }
    else if (side === "down") {
      const lit = propLevel >= 0 && layer <= propLevel;
      const wave = layer === propLevel;
      if (wave) { border = "border-accent"; glow = "0 0 0 2px #a78bfa, 0 0 22px #a78bfaaa"; wavePulse = true; }
      else if (lit) { border = "border-accent/70"; glow = "0 0 0 1px #8b5cf6aa"; }
      else opacity = 0.26;
      if (lit) badge = { text: String(layer), bg: "#8b5cf6" };
    } else opacity = 0.22; // 收拢的前因，暗下不消失
  } else if (mode === "trace") {
    if (origin) { border = "border-accent"; glow = "0 0 0 2px #a78bfa88"; badge = { text: "焦点", bg: "#8b5cf6" }; }
    else if (side === "up") {
      const rev = sideMax - layer; // 从根因(远)向锚点(近)推进
      const lit = propLevel >= 0 && rev <= propLevel;
      const wave = rev === propLevel;
      if (wave) { border = "border-amber-400"; glow = "0 0 0 2px #f59e0b, 0 0 20px #f59e0baa"; wavePulse = true; }
      else if (lit) { border = "border-amber-400/70"; glow = "0 0 0 1px #f59e0b88"; }
      else opacity = 0.26;
      if (lit) badge = { text: `第${layer}步`, bg: "#f59e0b" };
    } else opacity = 0.22; // 收拢的后果
  } else {
    // explore
    if (origin) { border = "border-accent"; glow = "0 0 0 2px #a78bfa88"; badge = { text: "焦点", bg: "#8b5cf6" }; }
    else if (role === "ctx") { border = "border-dashed border-ink-700"; opacity = 0.62; }
  }
  // 选中(非锚点)的次级高亮
  const selRing = sel && !origin;
  // 改本草稿态覆盖
  if (removed) { border = "border-rose-400/60"; opacity = 0.4; }
  else if (isNew) { border = "border-emerald-400"; glow = "0 0 0 2px #34d399, 0 0 18px #34d39988"; }
  else if (edited) { border = "border-sky-400/70"; glow = "0 0 0 1px #38bdf8aa, 0 0 13px #38bdf877"; }
  else if (affected && !origin) { glow = "0 0 0 1px #f59e0baa, 0 0 14px #f59e0b66"; }

  return (
    <div className={`relative rounded-xl border bg-ink-850 ${selRing ? "ring-2 ring-sky-400/60" : ""} ${border} ${wavePulse ? "blast-wave" : ""}`} style={{ width: NODE_W, height: NODE_H, opacity, boxShadow: glow }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <span className="absolute left-0 top-0 h-full w-1.5 rounded-l-xl" style={{ background: color }} />
      {removed && <span className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-ink-950/30"><span className="rounded bg-rose-500 px-2 py-0.5 text-[9px] font-bold text-white shadow">✗ 删除</span></span>}
      {isNew && <span className="absolute -left-1.5 -top-1.5 rounded-full bg-emerald-400 px-1.5 py-0.5 text-[8px] font-bold text-ink-950 shadow">＋新</span>}
      {affected && !origin && !removed && !isNew && <span className="absolute -right-1.5 top-3 rounded bg-amber-400/90 px-1 text-[8px] font-bold text-ink-950 shadow">波及</span>}
      {badge && <span className="absolute -right-1.5 -top-1.5 rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white shadow" style={{ background: badge.bg }}>{badge.text}</span>}
      {selRing && !removed && <span className="absolute -left-1.5 -top-1.5 rounded-full bg-sky-400 px-1.5 py-0.5 text-[8px] font-bold text-white shadow">选中</span>}
      <div className="flex h-full flex-col gap-1 py-2 pl-3.5 pr-2.5">
        <div className="flex items-center gap-1.5 text-[9px]">
          <span className="rounded px-1 py-0.5 font-medium" style={{ background: `${color}22`, color }}>{TYPE_LABEL[ev.type] ?? ev.type}</span>
          {edited && <span className="rounded bg-sky-400/90 px-1 py-0.5 text-[8px] font-bold text-ink-950" title="本次改本已改写此事件">✎改</span>}
          {flag && <span className="grid h-3 w-3 place-items-center rounded-full text-[7px] text-ink-950" style={{ background: flag === "error" ? "#fb7185" : flag === "warn" ? "#f59e0b" : "#38bdf8" }} title="逻辑体检发现问题">!</span>}
          {ev.act && <span className="rounded bg-accent/15 px-1 text-accent-soft">{ev.act}</span>}
          {ev.storyTime && <span className="text-zinc-600">{ev.storyTime}</span>}
          {mode === "explore" && side === "up" && <span className="ml-auto text-zinc-600">前因</span>}
          {mode === "explore" && side === "down" && <span className="ml-auto text-zinc-600">后果</span>}
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

function directedLayers(story: StoryGraph, origin: string, dir: "down" | "up", maxDepth = Infinity) {
  const adj = new Map<string, string[]>();
  for (const e of story.events) adj.set(e.id, []);
  for (const ed of story.edges) {
    if (dir === "down") { adj.get(ed.from)?.push(ed.to); if (ed.type === "contradicts") adj.get(ed.to)?.push(ed.from); }
    else { adj.get(ed.to)?.push(ed.from); if (ed.type === "contradicts") adj.get(ed.from)?.push(ed.to); }
  }
  const layerOf = new Map<string, number>([[origin, 0]]);
  let frontier = [origin], lvl = 0;
  while (frontier.length && lvl < maxDepth) {
    const next: string[] = [];
    for (const id of frontier) for (const nb of adj.get(id) ?? []) if (!layerOf.has(nb)) { layerOf.set(nb, lvl + 1); next.push(nb); }
    frontier = next; lvl++;
  }
  return layerOf;
}

/** 事件详图取点。blast/trace 时收拢侧保留近 1 跳（暗化不消失） */
function eventScope(story: StoryGraph, origin: string, mode: EventMode, depth: number) {
  const up = directedLayers(story, origin, "up", mode === "trace" ? Infinity : mode === "blast" ? 1 : depth);
  const down = directedLayers(story, origin, "down", mode === "blast" ? Infinity : mode === "trace" ? 1 : depth);
  const ids = new Set([...up.keys(), ...down.keys()]);
  const meta = new Map<string, { side: Side; layer: number }>();
  for (const id of ids) meta.set(id, id === origin ? { side: "origin", layer: 0 } : down.has(id) ? { side: "down", layer: down.get(id)! } : { side: "up", layer: up.get(id)! });
  const byId = new Map(story.events.map((e) => [e.id, e]));
  return { nodes: [...ids].map((id) => byId.get(id)!).filter(Boolean), edges: story.edges.filter((e) => ids.has(e.from) && ids.has(e.to)), spine: new Set([origin]), downMax: Math.max(0, ...down.values()), upMax: Math.max(0, ...up.values()), meta };
}

function computeScope(story: StoryGraph, detail: { kind: string; id: string }) {
  const adj = new Map<string, Set<string>>();
  for (const e of story.events) adj.set(e.id, new Set());
  for (const ed of story.edges) { adj.get(ed.from)?.add(ed.to); adj.get(ed.to)?.add(ed.from); }
  const spine = new Set<string>();
  if (detail.kind === "char") { for (const e of story.events) if (e.actors.some((a) => a.char === detail.id)) spine.add(e.id); }
  else { for (const e of story.events) if (e.act === detail.id) spine.add(e.id); }
  const all = new Set(spine);
  const frontier = new Set(spine);
  for (const id of frontier) for (const nb of adj.get(id) ?? []) all.add(nb);
  const byId = new Map(story.events.map((e) => [e.id, e]));
  return { nodes: [...all].map((id) => byId.get(id)!).filter(Boolean), edges: story.edges.filter((ed) => all.has(ed.from) && all.has(ed.to)), spine, downMax: 0, upMax: 0, meta: null };
}

export default function StoryDetail({ story, portraitOf = () => null }: { story: StoryGraph; portraitOf?: (c: string) => string | null }) {
  const { detailStack, eventMode, eventDepth, propLevel, selEvent, editing, draft, applied, toggleEdit, draftDeleteEvent, setPendingEdge, setEditNodeId, setEditStage, setPreview, pickEvent, openDetail, backDetail, jumpDetail, setEventMode, setEventDepth, set } = useUI();
  const detail = detailStack[detailStack.length - 1];
  const isEvent = detail?.kind === "event";
  const [baseNodes, setBaseNodes] = useState<Node[]>([]);
  const [baseEdges, setBaseEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [runId, setRunId] = useState(0);
  const [rf, setRf] = useState<any>(null);

  const labelOf = (d: { kind: string; id: string }) =>
    d.kind === "event" ? (story.events.find((e) => e.id === d.id)?.title ?? d.id).slice(0, 14) : d.id;

  const view = useMemo(() => {
    if (!detail) return { nodes: [] as StoryEvent[], edges: [], meta: null as any, spine: new Set<string>(), downMax: 0, upMax: 0 };
    return detail.kind === "event" ? eventScope(story, detail.id, eventMode, eventDepth) : computeScope(story, detail);
  }, [story, detail, eventMode, eventDepth]);
  const scopeIds = useMemo(() => new Set(view.nodes.map((n) => n.id)), [view]);
  const animMax = eventMode === "blast" ? view.downMax : eventMode === "trace" ? view.upMax : 0;

  // 改本：下游波及范围（确定性 BFS）
  const affected = useMemo(() => {
    if (!editing) return new Set<string>();
    const adj = new Map<string, string[]>();
    for (const e of story.events) adj.set(e.id, []);
    for (const e of draft.addEvents) adj.set(e.id, []);
    for (const ed of [...story.edges, ...draft.addEdges]) if (ed.type !== "contradicts") adj.get(ed.from)?.push(ed.to);
    const seeds = [...draft.removeEventIds, ...draft.addEvents.map((e) => e.id), ...draft.removeEdges.map((r) => r.to), ...draft.updateEvents.map((u) => u.id)];
    const seen = new Set<string>(seeds);
    let frontier = [...seeds];
    while (frontier.length) {
      const next: string[] = [];
      for (const id of frontier) for (const nb of adj.get(id) ?? []) if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
      frontier = next;
    }
    seeds.forEach((s) => seen.delete(s));
    return seen;
  }, [editing, draft, story]);

  const metrics = useMemo(() => {
    if (!isEvent || !view.meta) return null;
    const meta = view.meta as Map<string, { side: Side; layer: number }>;
    if (eventMode === "blast") {
      const down = view.nodes.filter((n) => meta.get(n.id)?.side === "down");
      const chars = new Set<string>(); down.forEach((n) => n.actors.forEach((a) => chars.add(a.char)));
      const ords = down.map((n) => n.actOrd).filter((o): o is number => o != null);
      return { kind: "blast" as const, count: down.length, chars: chars.size, lo: ords.length ? Math.min(...ords) : null, hi: ords.length ? Math.max(...ords) : null, touchEnd: down.some((n) => n.actOrd === 12 || n.type === "Outcome"), waves: view.downMax };
    }
    if (eventMode === "trace") {
      const upN = view.nodes.filter((n) => meta.get(n.id)?.side === "up");
      return { kind: "trace" as const, count: upN.length, depth: view.upMax, roots: upN.filter((n) => meta.get(n.id)!.layer === view.upMax).length };
    }
    return null;
  }, [isEvent, view, eventMode]);

  // 构图 + ELK
  useEffect(() => {
    let live = true;
    setLoading(true);
    const meta = view.meta as Map<string, { side: Side; layer: number }> | null;
    // 草稿新增事件并入布局（去重）
    const scopeSet = new Set(view.nodes.map((n) => n.id));
    const allNodes = editing ? [...view.nodes, ...draft.addEvents.filter((e) => !scopeSet.has(e.id))] : view.nodes;
    const patchMap = new Map(draft.updateEvents.map((u) => [u.id, u.patch]));
    const rfNodes: Node[] = allNodes.map((ev0) => {
      const ev = editing && patchMap.has(ev0.id) ? ({ ...ev0, ...patchMap.get(ev0.id) } as StoryEvent) : ev0; // 显示改写后的内容
      const m = meta?.get(ev.id);
      return {
        id: ev.id, type: "story", position: { x: 0, y: 0 },
        data: meta
          ? { ev, side: m?.side, layer: m?.layer, sideMax: m?.side === "up" ? view.upMax : view.downMax, mode: eventMode, origin: m?.side === "origin", affected: affected.has(ev.id) }
          : { ev, role: view.spine.has(ev.id) ? "spine" : "ctx", affected: affected.has(ev.id) },
      };
    });
    const nodeIds = new Set(rfNodes.map((n) => n.id));
    const allEdges = editing ? [...view.edges, ...draft.addEdges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to))] : view.edges;
    const rfEdges: Edge[] = allEdges.map((ed, i) => {
      let color = EDGE_COLOR[ed.type] ?? "#475569";
      let dash = ed.type === "contradicts" ? "5 4" : undefined;
      let w = 1.4, op = 1, anim = false;
      if (editing) {
        const removedEdge = draft.removeEdges.some((r) => r.from === ed.from && r.to === ed.to) || draft.removeEventIds.includes(ed.from) || draft.removeEventIds.includes(ed.to);
        const newEdge = draft.addEdges.some((a) => a.from === ed.from && a.to === ed.to);
        if (removedEdge) { color = "#52525b"; dash = "3 3"; op = 0.35; }
        else if (newEdge) { color = "#34d399"; w = 2; anim = true; }
      }
      return { id: `e${i}`, source: ed.from, target: ed.to, label: EDGE_LABEL[ed.type] ?? ed.type, type: "default", animated: anim, markerEnd: { type: MarkerType.ArrowClosed, color, width: 15, height: 15 }, style: { stroke: color, strokeWidth: w, strokeDasharray: dash, opacity: op }, labelStyle: { fill: "#cbd5e1", fontSize: 9 }, labelBgStyle: { fill: "#0f1015", fillOpacity: 0.85 }, labelBgPadding: [3, 1] as [number, number], data: { type: ed.type } };
    });
    const g: any = { id: "root", layoutOptions: { "elk.algorithm": "layered", "elk.direction": "RIGHT", "elk.layered.spacing.nodeNodeBetweenLayers": "96", "elk.spacing.nodeNode": "30", "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX" }, children: rfNodes.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })), edges: rfEdges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })) };
    elk.layout(g).then((res: any) => {
      if (!live) return;
      const posById = new Map((res.children ?? []).map((c: any) => [c.id, { x: c.x, y: c.y }]));
      setBaseNodes(rfNodes.map((n) => ({ ...n, position: (posById.get(n.id) as any) ?? { x: 0, y: 0 } })));
      setBaseEdges(rfEdges);
      setLoading(false);
    }).catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [view, eventMode, editing, draft, affected]);

  // 改本三段流水线：草稿变化 → ②引擎划范围(动画) → ③求解器盖章(/preview)
  useEffect(() => {
    if (!editing) return;
    const dirty = draft.removeEventIds.length + draft.addEvents.length + draft.removeEdges.length + draft.updateEvents.length > 0;
    if (!dirty) { setEditStage("idle"); setPreview(null); return; }
    let live = true;
    setEditStage("frame");
    setPreview(null);
    const t = setTimeout(async () => {
      if (!live) return;
      setEditStage("verify");
      try {
        const p = await postPreview({ addEvents: draft.addEvents, addEdges: draft.addEdges, removeEventIds: draft.removeEventIds, removeEdges: draft.removeEdges, updateEvents: draft.updateEvents }, applied);
        if (live) { setPreview(p); setEditStage("done"); }
      } catch { if (live) setEditStage("done"); }
    }, 1150);
    return () => { live = false; clearTimeout(t); };
  }, [editing, draft, applied, setEditStage, setPreview]);

  // 切换 scope 后自动 fit（相机平滑）
  useEffect(() => { if (!loading && rf) rf.fitView({ padding: 0.16, duration: 420 }); }, [baseNodes, rf]); // eslint-disable-line

  // 推演/溯源动画：逐波点亮
  useEffect(() => {
    if (!(isEvent && (eventMode === "blast" || eventMode === "trace"))) { set({ propLevel: -1 }); return; }
    set({ propLevel: 0 });
    let k = 0;
    const t = setInterval(() => { k++; set({ propLevel: k }); if (k >= animMax) clearInterval(t); }, 560);
    return () => { clearInterval(t); set({ propLevel: -1 }); };
  }, [isEvent, eventMode, animMax, runId, set]);

  // 边按模式着色 / 通电
  const edges = useMemo(() => {
    const meta = view.meta as Map<string, { side: Side; layer: number }> | null;
    if (!meta) return baseEdges;
    const litDown = (id: string) => { const m = meta.get(id); return m && (m.side === "origin" || (m.side === "down" && m.layer <= propLevel)); };
    const litUp = (id: string) => { const m = meta.get(id); return m && (m.side === "origin" || (m.side === "up" && view.upMax - m.layer <= propLevel)); };
    return baseEdges.map((e) => {
      if (eventMode === "blast") {
        const on = litDown(e.source) && litDown(e.target) && (meta.get(e.source)?.side !== "up" && meta.get(e.target)?.side !== "up");
        const downEdge = meta.get(e.source)?.side !== "up" && meta.get(e.target)?.side !== "up";
        return { ...e, animated: on, style: { ...e.style, stroke: on ? "#a78bfa" : "#3a3e4f", strokeWidth: on ? 2 : 1, opacity: on ? 1 : downEdge ? 0.2 : 0.05 } };
      }
      if (eventMode === "trace") {
        const on = litUp(e.source) && litUp(e.target) && (meta.get(e.source)?.side !== "down" && meta.get(e.target)?.side !== "down");
        const upEdge = meta.get(e.source)?.side !== "down" && meta.get(e.target)?.side !== "down";
        return { ...e, animated: on, style: { ...e.style, stroke: on ? "#f59e0b" : "#3a3e4f", strokeWidth: on ? 2 : 1, opacity: on ? 0.95 : upEdge ? 0.2 : 0.05 } };
      }
      return e;
    });
  }, [baseEdges, view, eventMode, propLevel]);

  if (!detail) return null;
  const kindLabel = detail.kind === "char" ? "故事线详图" : detail.kind === "act" ? "因果切面" : eventMode === "blast" ? "影响推演" : eventMode === "trace" ? "根因溯源" : "事件详图";

  return (
    <div className="relative h-full w-full bg-ink-950">
      <div className="absolute left-3 top-3 z-10 flex max-w-[68%] items-center gap-2">
        <button onClick={backDetail} className="flex shrink-0 items-center gap-1 rounded-lg border border-ink-700 bg-ink-900/90 px-2.5 py-1.5 text-[11px] text-zinc-300 backdrop-blur transition-colors hover:border-accent/60 hover:text-white" title="返回上一步"><Undo2 size={13} /> 上一步</button>
        <div className="flex min-w-0 items-center gap-1 overflow-hidden rounded-lg border border-ink-700 bg-ink-900/90 px-2.5 py-1.5 text-[11px] backdrop-blur">
          <button onClick={() => jumpDetail(-1)} className="shrink-0 text-zinc-400 transition-colors hover:text-white">总览</button>
          {detailStack.map((d, i) => {
            const cur = i === detailStack.length - 1;
            return (<Fragment key={i}><ChevronLeft size={11} className="shrink-0 rotate-180 text-zinc-600" /><button onClick={() => jumpDetail(i)} className={`max-w-[130px] truncate ${cur ? "font-semibold text-accent-soft" : "text-zinc-400 hover:text-zinc-100"}`}>{labelOf(d)}</button></Fragment>);
          })}
          <span className="shrink-0 pl-1 text-zinc-600">· {kindLabel}</span>
        </div>
      </div>

      {isEvent && (
        <div className="absolute left-3 top-[46px] z-10 flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-ink-700 bg-ink-900/90 backdrop-blur">
            <ModeBtn active={eventMode === "explore"} onClick={() => setEventMode("explore")} icon={<Network size={12} />}>因果邻域</ModeBtn>
            <ModeBtn active={eventMode === "blast"} onClick={() => setEventMode("blast")} icon={<Zap size={12} />} tone="accent">推演下游</ModeBtn>
            <ModeBtn active={eventMode === "trace"} onClick={() => setEventMode("trace")} icon={<Search size={12} />} tone="amber">溯源上游</ModeBtn>
          </div>
          {eventMode === "explore" && (
            <div className="flex items-center gap-1 rounded-lg border border-ink-700 bg-ink-900/90 px-2 py-1 text-[10px] backdrop-blur">
              <span className="text-zinc-500">深度</span>
              {[1, 2].map((d) => (<button key={d} onClick={() => setEventDepth(d)} className={`rounded px-1.5 py-0.5 ${eventDepth === d ? "bg-ink-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>{d}跳</button>))}
            </div>
          )}
          <span className="mx-1 h-4 w-px bg-ink-700" />
          <button onClick={toggleEdit} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] transition-colors ${editing ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200" : "border-ink-700 text-zinc-300 hover:border-emerald-400/50 hover:text-emerald-200"}`}>
            <Pencil size={12} /> {editing ? "退出改本" : "改本"}
          </button>
          {editing && selEvent && !draft.removeEventIds.includes(selEvent) && (
            <>
              <button onClick={() => setEditNodeId(selEvent)} className="flex items-center gap-1 rounded-lg border border-sky-400/50 bg-sky-500/10 px-2 py-1 text-[10.5px] text-sky-200 hover:bg-sky-500/20"><Pencil size={12} /> 编辑「{(story.events.find((e) => e.id === selEvent)?.title ?? "").slice(0, 8)}」</button>
              <button onClick={() => draftDeleteEvent(selEvent)} className="flex items-center gap-1 rounded-lg border border-rose-400/50 bg-rose-500/10 px-2 py-1 text-[10.5px] text-rose-200 hover:bg-rose-500/20"><Trash2 size={12} /> 删除「{(story.events.find((e) => e.id === selEvent)?.title ?? "").slice(0, 8)}」</button>
              {(() => {
                const succ = [...story.edges, ...draft.addEdges].find((e) => e.from === selEvent && !draft.removeEdges.some((r) => r.from === e.from && r.to === e.to));
                return succ ? (
                  <button onClick={() => setPendingEdge({ from: selEvent, to: succ.to })} className="flex items-center gap-1 rounded-lg border border-accent/50 bg-accent/10 px-2 py-1 text-[10.5px] text-accent-soft hover:bg-accent/20"><Sparkles size={12} /> 在此后插入剧情</button>
                ) : null;
              })()}
            </>
          )}
          {editing && <span className="text-[10px] text-zinc-600">选中事件可删/插入 · 或点画布上的因果边</span>}
          {!editing && <span className="text-[10px] text-zinc-600">工具条作用于「焦点」节点</span>}
        </div>
      )}

      {metrics?.kind === "blast" && (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-xl border border-accent/40 bg-ink-900/95 px-3 py-2 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 text-[11px]"><Zap size={14} className="text-accent-soft" /><span className="font-medium text-zinc-200">推演下游影响</span><button onClick={() => setRunId((r) => r + 1)} className="ml-1 flex items-center gap-0.5 rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-accent/60 hover:text-white"><RotateCcw size={10} /> 重播</button></div>
          <div className="mt-1.5 flex items-center gap-3 text-[11px]"><Metric label="波及事件" v={metrics.count} tone="text-accent-soft" /><Metric label="牵动角色" v={metrics.chars} tone="text-rose-200" /><Metric label="幕跨度" v={metrics.lo != null ? `${metrics.lo}→${metrics.hi}` : "—"} tone="text-zinc-200" /><Metric label="波数" v={`${Math.max(0, propLevel)}/${metrics.waves}`} tone="text-zinc-200" />{metrics.touchEnd && <span className="flex items-center gap-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-200"><AlertTriangle size={11} /> 触及结局/谜底</span>}</div>
        </div>
      )}
      {metrics?.kind === "trace" && (
        <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-amber-400/40 bg-ink-900/95 px-3 py-2 text-[11px] shadow-2xl backdrop-blur"><Search size={14} className="text-amber-300" /><span className="font-medium text-zinc-200">根因溯源</span><button onClick={() => setRunId((r) => r + 1)} className="flex items-center gap-0.5 rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-amber-400/60"><RotateCcw size={10} /> 重播</button><Metric label="前因事件" v={metrics.count} tone="text-amber-200" /><Metric label="深度" v={`${metrics.depth}步`} tone="text-zinc-200" /><Metric label="根因" v={metrics.roots} tone="text-amber-200" /></div>
      )}

      {loading && <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/60"><div className="flex items-center gap-2 text-sm text-zinc-400"><Loader2 size={15} className="animate-spin" />分层布局中…</div></div>}

      <ReactFlow nodes={baseNodes} edges={edges} nodeTypes={nodeTypes} onInit={setRf} fitView fitViewOptions={{ padding: 0.16 }} minZoom={0.2} maxZoom={1.6} nodesDraggable nodesConnectable={false}
        onNodeClick={(_, n) => { pickEvent(n.id); rf?.setCenter(n.position.x + NODE_W / 2, n.position.y + NODE_H / 2, { zoom: rf.getZoom?.() ?? 0.85, duration: 380 }); }}
        onNodeDoubleClick={(_, n) => { if (!editing) openDetail("event", n.id, "explore"); }}
        onEdgeClick={(_, e) => { if (editing) setPendingEdge({ from: e.source!, to: e.target! }); }}
        proOptions={{ hideAttribution: true }}>
        <Background color="#1b1d26" gap={24} />
      </ReactFlow>

      <InsertPanel story={story} />
      <EditNodePanel story={story} />
      <CascadeDrawer story={story} />
      <EditHUD affectedCount={affected.size} />
      {!editing && <div className="absolute bottom-3 right-3 z-10"><StoryMinimap story={story} highlight={scopeIds} caption={`${kindLabel}：${labelOf(detail)}`} portraitOf={portraitOf} /></div>}
    </div>
  );
}

function ModeBtn({ active, onClick, icon, tone, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; tone?: "accent" | "amber"; children: React.ReactNode }) {
  const onCls = tone === "accent" ? "bg-accent/25 text-accent-soft" : tone === "amber" ? "bg-amber-400/20 text-amber-200" : "bg-ink-700 text-zinc-100";
  return <button onClick={onClick} className={`flex items-center gap-1 px-2.5 py-1.5 text-[10.5px] transition-colors ${active ? onCls : "text-zinc-400 hover:text-zinc-200"}`}>{icon}{children}</button>;
}

function Metric({ label, v, tone }: { label: string; v: string | number; tone: string }) {
  return <span className="flex items-baseline gap-1"><span className="text-zinc-500">{label}</span><b className={tone}>{v}</b></span>;
}
