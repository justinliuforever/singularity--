import { useEffect, useMemo, useState } from "react";
import { Clapperboard, LogIn, MousePointerClick } from "lucide-react";
import { sliceGraph, type Graph, type GraphNode } from "@liumang/shared";
import { fetchGraph } from "./lib/api";
import { useUI } from "./store";
import MatrixLens from "./components/MatrixLens";
import RelationLens from "./components/RelationLens";
import ActScrubber from "./components/ActScrubber";
import TopBar from "./components/TopBar";
import Dossier from "./components/Dossier";
import NodeDetail from "./components/NodeDetail";
import ActDossier from "./components/ActDossier";
import TensionCurve from "./components/TensionCurve";

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [actOpen, setActOpen] = useState(false);
  const { mode, act, perspective, selFact, filter, order, onlyTimed, set, enterChar, pickFact } = useUI();

  useEffect(() => {
    fetchGraph()
      .then((g) => {
        setGraph(g);
        const third = g.meta.acts.find((a) => a.name === "第三幕");
        if (third) set({ act: third.ord });
      })
      .catch((e) => setErr(String(e.message ?? e)));
  }, [set]);

  const slice = useMemo(() => (graph ? sliceGraph(graph, act, perspective) : null), [graph, act, perspective]);
  const curActName = useMemo(() => graph?.meta.acts.find((a) => a.ord === act)?.name ?? `第${act}幕`, [graph, act]);
  const selNode: GraphNode | null = useMemo(() => (selFact && graph ? graph.nodes.find((n) => n.id === selFact) ?? null : null), [selFact, graph]);
  const portraitOf = (name: string) => graph?.nodes.find((n) => n.id === name)?.image ?? null;

  if (err)
    return (
      <div className="grid h-full place-items-center text-center text-rose-300">
        <div>
          <div className="text-sm">无法连接后端</div>
          <div className="mt-1 text-[11px] text-zinc-500">{err}</div>
          <div className="mt-2 text-[11px] text-zinc-600">请确认后端已启动（:8787）</div>
        </div>
      </div>
    );
  if (!graph || !slice) return <div className="grid h-full place-items-center text-zinc-500"><div className="animate-pulse text-sm">编译叙事图谱…</div></div>;

  return (
    <div className="flex h-full flex-col">
      <TopBar graph={graph} slice={slice} />

      <div className="flex min-h-0 flex-1">
        {/* 主舞台 */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* 工具条（独立一行，不压视图）：本幕 DM 流程 + 上帝模式的矩阵控件 */}
          <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-900/60 px-4 py-1.5">
            <button
              onClick={() => setActOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-accent/60 hover:text-white"
            >
              <Clapperboard size={13} /> 本幕 DM 流程
            </button>
            {mode === "scene" && <span className="text-[10px] text-zinc-600">点关系网里的人 → 进入 TA 的视角</span>}
            {mode === "god" && (
              <div className="flex items-center gap-2">
                <Seg opts={[["all", "全部"], ["shared", "共享"], ["false", "只看假信念"]]} value={filter} onChange={(v) => set({ filter: v as any })} />
                <Seg opts={[["act", "按幕"], ["camp", "按阵营"]]} value={order} onChange={(v) => set({ order: v as any })} />
                <button
                  onClick={() => set({ onlyTimed: !onlyTimed })}
                  className={`rounded-md border px-2 py-1 text-[10px] transition-colors ${onlyTimed ? "border-accent/60 bg-accent/15 text-accent-soft" : "border-ink-700 text-zinc-400 hover:text-zinc-200"}`}
                >
                  仅定时
                </button>
              </div>
            )}
          </div>

          <div className="relative min-h-0 flex-1">
            {mode === "scene" ? <RelationLens graph={graph} /> : <MatrixLens graph={graph} />}
            {actOpen && <ActDossier ord={act} name={curActName} onClose={() => setActOpen(false)} />}
          </div>
        </div>

        {/* 右栏：现场=认知卡/审问 · 上帝=事实详情/总览 */}
        <aside className="flex w-[384px] shrink-0 flex-col border-l border-ink-700 bg-ink-900">
          {mode === "scene" ? (
            perspective !== "god" ? (
              <Dossier character={perspective} actName={curActName} act={act} slice={slice} portrait={portraitOf(perspective)} />
            ) : (
              <ScenePanel graph={graph} onEnter={enterChar} />
            )
          ) : selNode ? (
            <NodeDetail graph={graph} node={selNode} onClose={() => pickFact(null)} />
          ) : (
            <GodPanel graph={graph} act={act} />
          )}
        </aside>
      </div>

      {/* 底部统一幕轴 */}
      <ActScrubber graph={graph} />
    </div>
  );
}

function Seg({ opts, value, onChange }: { opts: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-ink-700">
      {opts.map(([v, t]) => (
        <button key={v} onClick={() => onChange(v)} className={`px-2 py-1 text-[10px] transition-colors ${value === v ? "bg-ink-700 text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}

/** 现场模式·未进入任何角色时的引导面板 */
function ScenePanel({ graph, onEnter }: { graph: Graph; onEnter: (p: string) => void }) {
  const pcs = graph.nodes.filter((n) => n.kind === "character" && n.role === "PC");
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-ink-700 px-4 py-3">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-200">
          <MousePointerClick size={14} className="text-rose-300" /> 入局：成为一个角色
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          点关系网里的人，或下面任一角色 → 进入 TA 的视角：看 TA 这一幕<b className="text-zinc-300">知道什么、被瞒什么、手上有哪些线索、要守哪些秘密</b>，并直接审问 TA。
        </p>
      </div>
      <div className="border-b border-ink-700 p-4">
        <div className="grid grid-cols-2 gap-1.5">
          {pcs.map((p) => (
            <button
              key={p.id}
              onClick={() => onEnter(p.id)}
              className="flex items-center gap-2 rounded-lg border border-ink-700 px-2 py-2 text-[11px] text-zinc-300 transition-colors hover:border-rose-400/50 hover:text-rose-100"
            >
              <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-ink-700 ring-1 ring-rose-400/40">
                {p.image ? <img src={p.image} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center">{p.label.slice(0, 1)}</span>}
              </span>
              <span className="truncate">{p.label}</span>
              <LogIn size={12} className="ml-auto shrink-0 text-zinc-600" />
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 py-3 text-[10px] leading-relaxed text-zinc-600">
        这就是<b className="text-zinc-400">对抗 agent</b> 的底座：每个角色只拿得到 TA 该有的信息，结构上吐不出不该知道的真相。
      </div>
    </div>
  );
}

/** 上帝模式·未选事实时的总览面板 */
function GodPanel({ graph, act }: { graph: Graph; act: number }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-ink-700 px-4 py-3 text-[10px] text-zinc-500">
        <div className="mb-1.5 font-medium text-zinc-400">怎么读这张认知矩阵</div>
        <p className="leading-relaxed">
          每<b className="text-zinc-300">行</b>一个角色、每<b className="text-zinc-300">列</b>一条事实。
          <span className="text-know">蓝✓</span>=知道、<span className="text-amber-300">金🔒</span>=知道且须隐瞒、
          <span className="text-truthlie">红✗</span>=被骗、空=墙后不知。底部<span className="text-reveal">客观真相</span>行=全场可揭示的真相。
          一眼看尽：谁被骗了什么、谁握着秘密、信息阵营如何分布。
        </p>
        <p className="mt-1.5 leading-relaxed text-zinc-600">点格子看详情 · 切「按阵营」让知识同盟聚成色块 · 拖底部幕轴看矩阵随剧情逐列点亮。</p>
      </div>
      <TensionCurve graph={graph} act={act} />
    </div>
  );
}
