import { useState, useEffect, useRef } from "react";
import { Users, Send, Loader2, Play, RotateCcw, BrickWall, AlertTriangle, ChevronRight, Square, Sparkles } from "lucide-react";
import type { Graph } from "@liumang/shared";
import { useUI } from "../store";
import { sceneTurn, sceneSuggest, sceneReferee } from "../lib/api";

/** C1 同台对质：选 2–6 个角色上台 → 你抛问题/点建议 → agent 自动一轮依次对撞；可继续/停 */
export default function StagePanel({ graph, actName, portraitOf }: { graph: Graph; actName: string; portraitOf: (n: string) => string | null }) {
  const { stageCast, stageTurns, stageBusy, stageRunning, stageSuggest, toggleStageCast, appendStageTurn, setStageBusy, setStageRunning, setStageSuggest, setStageContradictions, resetStage } = useUI();
  const [started, setStarted] = useState(stageTurns.length > 0);
  const [input, setInput] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const stopRef = useRef(false);
  const pcs = graph.nodes.filter((n) => n.kind === "character" && n.role === "PC");

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [stageTurns, stageBusy]);
  // 进台先讨一批开场建议
  useEffect(() => {
    if (started && !stageTurns.length && !stageSuggest.length) sceneSuggest(actName, stageCast, []).then(setStageSuggest).catch(() => {});
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [started]);

  // 最新一句逐字打出（主持瞬显）
  const [typing, setTyping] = useState<{ idx: number; n: number }>({ idx: -1, n: 0 });
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const last = stageTurns.length - 1;
    if (last < 0) return;
    const tt = stageTurns[last];
    if (tt.speaker === "主持") return;
    if (typeTimer.current) clearInterval(typeTimer.current);
    let n = 0;
    setTyping({ idx: last, n: 0 });
    typeTimer.current = setInterval(() => {
      n += 2;
      setTyping({ idx: last, n });
      if (n >= tt.text.length) { if (typeTimer.current) clearInterval(typeTimer.current); typeTimer.current = null; }
    }, 22);
    return () => { if (typeTimer.current) clearInterval(typeTimer.current); };
  }, [stageTurns.length]);

  const lines = () => stageTurns.map((t) => ({ speaker: t.speaker, text: t.text }));

  /** 一轮里下一个该说的人：被点名优先，否则在场里最久没说的（本轮未说过的优先轮一遍） */
  function pickNext(t: { speaker: string; text: string }[], spoken: Set<string>): string | null {
    const remaining = stageCast.filter((p) => !spoken.has(p));
    if (!remaining.length) return null;
    const last = t[t.length - 1];
    if (last) for (const p of remaining) if (last.text.includes(p)) return p;
    const lastIdx: Record<string, number> = {};
    t.forEach((x, i) => (lastIdx[x.speaker] = i));
    return [...remaining].sort((a, b) => (lastIdx[a] ?? -1) - (lastIdx[b] ?? -1))[0];
  }

  /** 跑自动一轮：每人依次说一句（导演顺序），可被"停"打断 */
  async function runRound(seed?: string) {
    if (stageRunning) return;
    stopRef.current = false;
    setStageRunning(true);
    setStageSuggest([]);
    let t = lines();
    if (seed?.trim()) {
      const line = { speaker: "主持", text: seed.trim() };
      appendStageTurn(line);
      t = [...t, line];
      setInput("");
    }
    const spoken = new Set<string>();
    let guard = 0;
    while (spoken.size < stageCast.length && guard < stageCast.length + 2 && !stopRef.current) {
      const next = pickNext(t, spoken);
      if (!next) break;
      setStageBusy(next);
      try {
        const r = await sceneTurn(actName, stageCast, t, next);
        appendStageTurn({ speaker: next, text: r.text, grounding: r.grounding, replyLeaked: r.replyLeaked });
        t = [...t, { speaker: next, text: r.text }];
      } catch {
        break;
      }
      spoken.add(next);
      guard++;
    }
    setStageBusy(null);
    setStageRunning(false);
    sceneSuggest(actName, stageCast, t).then(setStageSuggest).catch(() => {});
    sceneReferee(actName, stageCast, t).then(setStageContradictions).catch(() => {});
  }

  const Avatar = ({ name, size = 28 }: { name: string; size?: number }) => {
    const img = portraitOf(name);
    return (
      <span className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-ink-700 text-[10px] text-zinc-300 ring-1 ring-rose-400/30" style={{ width: size, height: size }}>
        {img ? <img src={img} className="h-full w-full object-cover" /> : name.slice(0, 1)}
      </span>
    );
  };

  // —— 选角 ——
  if (!started) {
    return (
      <div className="grid h-full place-items-center bg-ink-950 p-6">
        <div className="w-[460px] max-w-full rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-zinc-100"><Users size={16} className="text-rose-300" /> 同台对质 · 选这场戏的人</div>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">选 2–6 个角色上台（{actName}）。他们各带<b className="text-zinc-300">自己的迷雾认知</b>当众对峙——都听得见台上的话，但结构上守得住各自的秘密。你抛问题、他们自动对撞。</p>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {pcs.map((p) => {
              const on = stageCast.includes(p.id);
              return (
                <button key={p.id} onClick={() => toggleStageCast(p.id)} className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-[11px] transition-colors ${on ? "border-rose-400/60 bg-rose-500/10 text-rose-100" : "border-ink-700 text-zinc-300 hover:border-rose-400/40"}`}>
                  <Avatar name={p.id} size={24} />
                  <span className="truncate">{p.label}</span>
                  {on && <span className="ml-auto text-rose-300">✓</span>}
                </button>
              );
            })}
          </div>
          <button disabled={stageCast.length < 2} onClick={() => setStarted(true)} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-500/80 py-2 text-[12px] font-medium text-white transition-colors hover:bg-rose-500 disabled:opacity-40">
            <Play size={14} /> 开始这场戏（{stageCast.length}/6）
          </button>
        </div>
      </div>
    );
  }

  // —— 舞台 ——
  return (
    <div className="flex h-full flex-col bg-ink-950">
      {/* 在场条 */}
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-900/60 px-3 py-2">
        <span className="text-[10px] text-zinc-500">在场 · {actName}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {stageCast.map((c) => {
            const speaking = stageBusy === c;
            return (
              <div key={c} className={`flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 transition-all ${speaking ? "bg-rose-400/15 ring-1 ring-rose-400/60" : ""}`}>
                <Avatar name={c} size={22} />
                <span className={`text-[10.5px] ${speaking ? "text-rose-200" : "text-zinc-300"}`}>{c}</span>
                {speaking && <Loader2 size={10} className="animate-spin text-rose-300" />}
              </div>
            );
          })}
        </div>
        <button onClick={() => { resetStage(); setStarted(false); }} className="ml-auto flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-200"><RotateCcw size={11} /> 重开/换人</button>
      </div>

      {/* 对话流 */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {stageTurns.length === 0 && <div className="pt-6 text-center text-[11px] text-zinc-600">抛一个问题（或点下面的建议），台上就开始自动对撞。</div>}
        {stageTurns.map((t, i) => {
          if (t.speaker === "主持") return <div key={i} className="stage-in mx-auto max-w-[82%] rounded-lg bg-accent/15 px-3 py-1.5 text-center text-[11px] text-accent-soft">导演／主持：{t.text}</div>;
          const typingThis = i === typing.idx && typing.n < t.text.length;
          const showText = typingThis ? t.text.slice(0, typing.n) : t.text;
          return (
            <div key={i} className="stage-in flex items-start gap-2">
              <Avatar name={t.speaker} size={30} />
              <div className="min-w-0 max-w-[82%]">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <b className="text-rose-200">{t.speaker}</b>
                  {!typingThis && t.grounding?.pokesWall && <span className="flex items-center gap-0.5 rounded bg-rose-500/15 px-1 text-[8.5px] text-rose-200"><BrickWall size={9} /> 戳墙·回避</span>}
                  {!typingThis && t.replyLeaked && <span className="flex items-center gap-0.5 rounded bg-amber-500/20 px-1 text-[8.5px] text-amber-200"><AlertTriangle size={9} /> 疑漏</span>}
                </div>
                <div className="mt-0.5 whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-ink-800 px-3 py-2 text-[12px] leading-relaxed text-rose-50">{showText}{typingThis && <span className="caret">&nbsp;</span>}</div>
              </div>
            </div>
          );
        })}
        {stageBusy && <div className="flex items-center gap-2 pl-1 text-[11px] text-zinc-500"><Loader2 size={13} className="animate-spin" /> {stageBusy} 正在斟酌…</div>}
        <div ref={bottom} />
      </div>

      {/* 导演台 */}
      <div className="border-t border-ink-700 bg-ink-900/60 px-3 py-2.5">
        {stageSuggest.length > 0 && !stageRunning && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 text-[9.5px] text-zinc-500"><Sparkles size={11} className="text-accent-soft" /> 抛个问题：</span>
            {stageSuggest.map((q, i) => (
              <button key={i} onClick={() => runRound(q)} className="rounded-full border border-ink-700 bg-ink-850 px-2 py-1 text-[10.5px] text-zinc-300 transition-colors hover:border-accent/50 hover:text-zinc-100">{q}</button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runRound(input)} disabled={stageRunning} placeholder="导演台：向全场提问 / 抛一个指控…" className="flex-1 rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60 disabled:opacity-50" />
          <button onClick={() => runRound(input)} disabled={stageRunning || !input.trim()} title="向全场抛出，台上自动对撞一轮" className="grid h-8 w-8 place-items-center rounded-lg bg-accent/80 text-white hover:bg-accent disabled:opacity-40"><Send size={14} /></button>
          {stageRunning ? (
            <button onClick={() => { stopRef.current = true; }} className="flex items-center gap-1 rounded-lg bg-rose-500/80 px-2.5 py-1.5 text-[11px] text-white hover:bg-rose-500"><Square size={12} /> 停</button>
          ) : (
            <button onClick={() => runRound()} disabled={stageTurns.length === 0} title="不抛新问题，让台上接着对撞一轮" className="flex items-center gap-1 rounded-lg border border-rose-400/50 px-2.5 py-1.5 text-[11px] text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"><ChevronRight size={12} /> 继续</button>
          )}
        </div>
        <div className="mt-1 text-[9px] text-zinc-600">{stageRunning ? "台上自动对撞中——可随时「停」" : "发送=抛问题并自动跑一轮 · 继续=他们接着吵一轮"}</div>
      </div>
    </div>
  );
}
