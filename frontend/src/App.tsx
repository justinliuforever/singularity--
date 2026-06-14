import { useEffect, useMemo, useState } from "react";
import { Clapperboard, LogIn, MousePointerClick, Loader2 } from "lucide-react";
import { sliceGraph, type Graph, type StoryGraph } from "@liumang/shared";
import { fetchGraph, fetchStory } from "./lib/api";
import { useUI } from "./store";
import RelationLens from "./components/RelationLens";
import StoryCanvas from "./components/StoryCanvas";
import StoryDetail from "./components/StoryDetail";
import EventDetail from "./components/EventDetail";
import ActScrubber from "./components/ActScrubber";
import TopBar from "./components/TopBar";
import Dossier from "./components/Dossier";
import ActDossier from "./components/ActDossier";
import TensionCurve from "./components/TensionCurve";

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [story, setStory] = useState<StoryGraph | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [actOpen, setActOpen] = useState(false);
  const { mode, act, perspective, selEvent, detailStack, set, enterChar } = useUI();
  const detail = detailStack[detailStack.length - 1] ?? null;

  useEffect(() => {
    fetchGraph()
      .then((g) => {
        setGraph(g);
        const third = g.meta.acts.find((a) => a.name === "第三幕");
        if (third) set({ act: third.ord });
      })
      .catch((e) => setErr(String(e.message ?? e)));
    fetchStory().then(setStory).catch(() => {});
  }, [set]);

  const slice = useMemo(() => (graph ? sliceGraph(graph, act, perspective) : null), [graph, act, perspective]);
  const curActName = useMemo(() => graph?.meta.acts.find((a) => a.ord === act)?.name ?? `第${act}幕`, [graph, act]);
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
          {/* 工具条 */}
          <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-900/60 px-4 py-1.5">
            <button
              onClick={() => setActOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-accent/60 hover:text-white"
            >
              <Clapperboard size={13} /> 本幕 DM 流程
            </button>
            {mode === "scene" ? (
              <span className="text-[10px] text-zinc-600">点关系网里的人 → 进入 TA 的视角</span>
            ) : (
              <span className="text-[10px] text-zinc-600">创作画布 · 每行一个角色、每列一幕 · 卡片=事件 · 连线=因果 · 点角色泳道聚焦 TA 的主线 · 点事件看因果</span>
            )}
          </div>

          <div className="relative min-h-0 flex-1">
            {mode === "scene" ? (
              <RelationLens graph={graph} />
            ) : story ? (
              detail ? (
                <StoryDetail story={story} portraitOf={portraitOf} />
              ) : (
                <StoryCanvas story={story} portraitOf={portraitOf} />
              )
            ) : (
              <div className="grid h-full place-items-center text-zinc-500"><div className="flex items-center gap-2 text-sm"><Loader2 size={15} className="animate-spin" />编织故事图…</div></div>
            )}
            {actOpen && <ActDossier ord={act} name={curActName} onClose={() => setActOpen(false)} />}
          </div>
        </div>

        {/* 右栏 */}
        <aside className="flex w-[384px] shrink-0 flex-col border-l border-ink-700 bg-ink-900">
          {mode === "scene" ? (
            perspective !== "god" ? (
              <Dossier character={perspective} actName={curActName} act={act} slice={slice} portrait={portraitOf(perspective)} />
            ) : (
              <ScenePanel graph={graph} onEnter={enterChar} />
            )
          ) : selEvent && story ? (
            <EventDetail story={story} eventId={selEvent} />
          ) : (
            <GodPanel graph={graph} act={act} story={story} />
          )}
        </aside>
      </div>

      <ActScrubber graph={graph} />
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

/** 上帝模式·未选事件时的总览面板 */
function GodPanel({ graph, act, story }: { graph: Graph; act: number; story: StoryGraph | null }) {
  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-ink-700 px-4 py-3 text-[10px] text-zinc-500">
        <div className="mb-1.5 font-medium text-zinc-400">创作画布 · 怎么读</div>
        <p className="leading-relaxed">
          每<b className="text-zinc-300">行</b>是一个角色（PC + 关键 NPC），每<b className="text-zinc-300">列</b>是一幕（最左是开局前的背景）。
          每张<b className="text-zinc-300">卡片</b>是一个事件（颜色=类型：<span className="text-violet-300">决定</span>/<span className="text-rose-300">谎言</span>/<span className="text-emerald-300">揭露</span>…），<b className="text-zinc-300">连线</b>是因果（动机/导致/使能/<span className="text-rose-300">矛盾</span>）。
        </p>
        <p className="mt-1.5 leading-relaxed text-zinc-600">点角色泳道 → 聚焦 TA 的主线 · 点事件 → 看它的因果上下游 · 沿因果链就能追"谁因为什么做了什么"。</p>
        {story && (
          <div className="mt-2 flex gap-3 text-[11px]">
            <span className="text-zinc-400">事件 <b className="text-zinc-100">{story.events.length}</b></span>
            <span className="text-zinc-400">因果边 <b className="text-zinc-100">{story.edges.length}</b></span>
            <span className="text-zinc-400">角色 <b className="text-zinc-100">{story.cast.length}</b></span>
          </div>
        )}
      </div>
      <div className="px-4 py-2 text-[10px] text-zinc-600">下一步将在此基础上做：改一处 → 引擎推演影响范围（神经激活动画）。</div>
      <TensionCurve graph={graph} act={act} />
    </div>
  );
}
