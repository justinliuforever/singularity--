import { useEffect, useMemo, useState } from "react";
import { Clapperboard, LogIn, MousePointerClick, Loader2, Stethoscope, UserPlus } from "lucide-react";
import { sliceGraph, type Graph, type StoryGraph } from "@liumang/shared";
import { fetchGraph, fetchStory, fetchAudit, postPreview } from "./lib/api";
import { useUI } from "./store";
import { applyDraft } from "./lib/draft";
import { injectSessionChars, charsToStoryDraft } from "./lib/sessionGraph";
import RelationLens from "./components/RelationLens";
import StagePanel from "./components/StagePanel";
import StageJudge from "./components/StageJudge";
import StoryCanvas from "./components/StoryCanvas";
import StoryDetail from "./components/StoryDetail";
import EventDetail from "./components/EventDetail";
import AuditPanel from "./components/AuditPanel";
import CharacterForge from "./components/CharacterForge";
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
  const [auditOpen, setAuditOpen] = useState(false);
  const [forgeOpen, setForgeOpen] = useState(false);
  const { mode, act, perspective, selEvent, detailStack, audit, applied, liveStage, sessionChars, set, setAudit, setLiveStage, enterChar, closeDetail } = useUI();
  const detail = detailStack[detailStack.length - 1] ?? null;
  /** 本会话生效的故事图 = 原图 + 已应用改动 + 本会话采纳新角色的剧情（刷新即还原，不写本子） */
  const eStory = useMemo(() => {
    if (!story) return null;
    let s = applyDraft(story, applied);
    if (sessionChars.length) {
      const existing = new Set(s.events.map((e) => e.id));
      const { addEvents, addEdges } = charsToStoryDraft(sessionChars, existing);
      if (addEvents.length) s = applyDraft(s, { addEvents, addEdges, removeEventIds: [], removeEdges: [], updateEvents: [] });
      // 把新角色加进 cast → 左列泳道才会出现 ta（事件落到 ta 自己的泳道，而非同场角色的）
      const newCast = sessionChars
        .filter((c) => c.storyEvents.length && !s.cast.some((x) => x.char === c.name))
        .map((c) => ({ char: c.name, count: c.storyEvents.length, isPC: false }));
      if (newCast.length) s = { ...s, cast: [...newCast, ...s.cast] };
    }
    return s;
  }, [story, applied, sessionChars]);
  /** 本会话新增角色名（画布泳道高亮 + 强制显示） */
  const newCharNames = useMemo(() => new Set(sessionChars.map((c) => c.name)), [sessionChars]);
  // 应用删除后，若当前锚点/选中事件已不在图中 → 优雅回退，避免空详图
  useEffect(() => {
    if (!eStory) return;
    const ids = new Set(eStory.events.map((e) => e.id));
    if (detail?.kind === "event" && !ids.has(detail.id)) closeDetail();
    if (selEvent && !ids.has(selEvent)) set({ selEvent: null });
  }, [eStory, detail, selEvent, closeDetail, set]);

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

  // 体检随"已应用改动"刷新：无改动→base 体检；有改动→对 base+applied 重检（徽章不再过时）
  useEffect(() => {
    const empty = !applied.addEvents.length && !applied.addEdges.length && !applied.removeEventIds.length && !applied.removeEdges.length;
    if (empty) { fetchAudit().then(setAudit).catch(() => {}); return; }
    postPreview(applied).then((p) => setAudit({ findings: p.after.findings, stats: p.after.stats })).catch(() => {});
  }, [applied, setAudit]);

  const slice = useMemo(() => (graph ? sliceGraph(graph, act, perspective) : null), [graph, act, perspective]);
  /** 关系网用的图 = 原图 + 本会话采纳的新角色（仅注入关系网，不波及审问/同台/KB；刷新即还原） */
  const { graph: lensGraph, draftNames } = useMemo(() => (graph ? injectSessionChars(graph, sessionChars) : { graph: graph as any, draftNames: new Set<string>() }), [graph, sessionChars]);
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
              <>
                <div className="flex overflow-hidden rounded-lg border border-ink-700">
                  <button onClick={() => setLiveStage(false)} className={`px-2.5 py-1.5 text-[11px] transition-colors ${!liveStage ? "bg-rose-500/20 text-rose-100" : "text-zinc-400 hover:text-zinc-200"}`}>单人审问</button>
                  <button onClick={() => setLiveStage(true)} className={`px-2.5 py-1.5 text-[11px] transition-colors ${liveStage ? "bg-rose-500/20 text-rose-100" : "text-zinc-400 hover:text-zinc-200"}`}>同台对质</button>
                </div>
                <span className="text-[10px] text-zinc-600">{liveStage ? "选 2–4 人上台 · 你当导演" : "点关系网里的人 → 进入 TA 的视角"}</span>
              </>
            ) : (
              <>
                <button
                  onClick={() => setAuditOpen(true)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${audit && audit.findings.length ? "border-amber-400/50 text-amber-200 hover:bg-amber-400/10" : "border-ink-700 text-zinc-300 hover:border-emerald-400/50 hover:text-emerald-200"}`}
                >
                  <Stethoscope size={13} /> 逻辑体检{audit ? ` · ${audit.findings.length}` : ""}
                </button>
                <button
                  onClick={() => setForgeOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1.5 text-[11px] text-zinc-300 transition-colors hover:border-accent/60 hover:text-white"
                >
                  <UserPlus size={13} /> 加人物
                </button>
                <span className="text-[10px] text-zinc-600">双击事件展开 · 点泳道聚焦角色主线</span>
              </>
            )}
          </div>

          <div className="relative min-h-0 flex-1">
            {mode === "scene" ? (
              liveStage ? <StagePanel graph={graph} actName={curActName} portraitOf={portraitOf} /> : <RelationLens graph={lensGraph} draftNames={draftNames} />
            ) : eStory ? (
              detail ? (
                <StoryDetail story={eStory} portraitOf={portraitOf} />
              ) : (
                <StoryCanvas story={eStory} portraitOf={portraitOf} newChars={newCharNames} />
              )
            ) : (
              <div className="grid h-full place-items-center text-zinc-500"><div className="flex items-center gap-2 text-sm"><Loader2 size={15} className="animate-spin" />编织故事图…</div></div>
            )}
            {actOpen && <ActDossier ord={act} name={curActName} onClose={() => setActOpen(false)} />}
            {auditOpen && <AuditPanel onClose={() => setAuditOpen(false)} />}
            {forgeOpen && <CharacterForge onClose={() => setForgeOpen(false)} />}
          </div>
        </div>

        {/* 右栏 */}
        <aside className="flex w-[384px] shrink-0 flex-col border-l border-ink-700 bg-ink-900">
          {mode === "scene" ? (
            liveStage ? (
              <StageJudge actName={curActName} />
            ) : perspective !== "god" ? (
              <Dossier character={perspective} actName={curActName} act={act} slice={slice} portrait={portraitOf(perspective)} />
            ) : (
              <ScenePanel graph={graph} onEnter={enterChar} />
            )
          ) : selEvent && eStory ? (
            <EventDetail story={eStory} eventId={selEvent} anchorId={detail?.kind === "event" ? detail.id : null} />
          ) : (
            <GodPanel graph={graph} act={act} story={eStory} />
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
