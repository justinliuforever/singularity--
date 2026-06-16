import { useState, useEffect } from "react";
import { Eye, EyeOff, ShieldCheck, AlertTriangle, BrickWall, Gavel, Brain, ChevronDown, ChevronRight, Target, Lock } from "lucide-react";
import { useUI } from "../store";
import { sceneCast, type CastInfo } from "../lib/api";

/** 同台 · 裁判/创作者视角（右栏）：各人盘算（目标/处境/秘密）+ 防泄漏 + 跨角色对质点 + 逐句测谎 */
export default function StageJudge({ actName }: { actName: string }) {
  const { stageTurns, stageCast, peekWall, stageContradictions, set } = useUI();
  const said = stageTurns.filter((t) => t.speaker !== "主持");
  const leaks = said.filter((t) => t.replyLeaked).length;
  const walls = said.filter((t) => t.grounding?.pokesWall);
  const [cast, setCast] = useState<CastInfo[]>([]);
  const [open, setOpen] = useState<string | null>(null); // 展开哪个人的细节
  const [castShown, setCastShown] = useState(true);

  useEffect(() => {
    if (!stageCast.length) return setCast([]);
    sceneCast(actName, stageCast).then(setCast).catch(() => {});
  }, [stageCast.join("|"), actName]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-850 px-3 py-2.5 text-[11px]">
        <Gavel size={14} className="text-amber-300" />
        <span className="font-medium text-zinc-200">裁判 · 创作者视角</span>
        <button onClick={() => set({ peekWall: !peekWall })} title="开则显示各人秘密/误信背后真相（玩家永远看不到）" className={`ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] transition-colors ${peekWall ? "bg-amber-500/20 text-amber-200" : "bg-ink-700 text-zinc-500 hover:text-zinc-300"}`}>
          {peekWall ? <Eye size={10} /> : <EyeOff size={10} />} 窥视墙后
        </button>
      </div>

      <div className={`px-3 py-2 text-[10px] ${leaks ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/10 text-emerald-200"}`}>
        {leaks ? (
          <span className="flex items-center gap-1"><AlertTriangle size={12} /> 本场疑似泄漏 {leaks} 句——需查</span>
        ) : (
          <span className="flex items-center gap-1"><ShieldCheck size={12} /> 本场 {said.length} 句 · 0 漏：每人只带自己迷雾 KB，结构上吐不出墙后真相</span>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3 text-[10.5px]">
        {/* 各人盘算（写本子的看逻辑：谁想干什么、在守什么、误信什么） */}
        {cast.length > 0 && (
          <div>
            <button onClick={() => setCastShown((v) => !v)} className="flex w-full items-center gap-1.5 text-[10px] font-medium text-zinc-300">
              {castShown ? <ChevronDown size={11} /> : <ChevronRight size={11} />}<Brain size={11} className="text-accent-soft" /> 在场各人的盘算（{cast.length}）
              <span className="ml-auto text-[8.5px] text-zinc-600">目标公开 · 秘密需窥视</span>
            </button>
            {castShown && (
              <div className="mt-1.5 space-y-1">
                {cast.map((c) => {
                  const isOpen = open === c.name;
                  const hasSecret = c.secrets.length || c.falseBeliefs.length;
                  return (
                    <div key={c.name} className="rounded-lg border border-ink-700 bg-ink-850/60 px-2.5 py-1.5">
                      <button onClick={() => setOpen(isOpen ? null : c.name)} className="flex w-full items-start gap-1.5 text-left">
                        <b className="shrink-0 text-rose-200">{c.name}</b>
                        <span className="flex items-start gap-1 text-[10px] text-zinc-400"><Target size={10} className="mt-0.5 shrink-0 text-zinc-500" />{c.goal ? c.goal.slice(0, 46) + (c.goal.length > 46 ? "…" : "") : "（本幕无明确目标）"}</span>
                        {(c.perceives || hasSecret) && <span className="ml-auto shrink-0 text-zinc-600">{isOpen ? "▾" : "▸"}</span>}
                      </button>
                      {isOpen && (
                        <div className="mt-1 space-y-1 border-t border-ink-700 pt-1 text-[10px]">
                          {c.perceives && <div className="text-zinc-400">处境：{c.perceives}</div>}
                          {peekWall ? (
                            <>
                              {c.secrets.map((s, i) => <div key={i} className="flex items-start gap-1 text-amber-200"><Lock size={9} className="mt-0.5 shrink-0" />守：{s}</div>)}
                              {c.falseBeliefs.map((f, i) => <div key={i} className="text-amber-200/90">误信「{f.belief.slice(0, 28)}」→ 真相「<b className="text-amber-100">{f.truth.slice(0, 40)}</b>」</div>)}
                              {!hasSecret && <div className="text-zinc-600">（无登记的秘密/误信）</div>}
                            </>
                          ) : hasSecret ? (
                            <div className="text-zinc-600">守 {c.secrets.length} 个秘密 · 误信 {c.falseBeliefs.length} 处——开「窥视墙后」看真相</div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* C2 洞察·谁在瞒（嘴上 vs 实情）——agent 在隐瞒/装不知/甩锅/说谎 */}
        {stageContradictions.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-amber-200"><Eye size={12} /> 洞察 · 谁在瞒（{stageContradictions.length}）</div>
            {stageContradictions.map((p, i) => (
              <div key={i} className="rounded-lg border border-amber-400/40 bg-amber-500/5 px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <b className="text-[10.5px] text-amber-100">{p.by}</b>
                  <span className="rounded bg-amber-400/20 px-1 py-0.5 text-[8px] font-bold text-amber-200">{p.tag}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-zinc-300">嘴上：「{p.said}」</div>
                <div className="text-[10px] text-amber-200/90">实情：<b className="text-amber-100">「{p.truth}」</b></div>
                {p.note && <div className="mt-0.5 text-[9.5px] text-zinc-400">{p.note}</div>}
              </div>
            ))}
          </div>
        )}

        {walls.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="text-[10px] text-zinc-500">被逼近命门 · 只能回避{peekWall ? "（含墙后真相）" : ""}</div>
            {walls.map((t, i) => (
              <div key={i} className="rounded-lg border border-rose-400/30 bg-rose-500/5 px-2.5 py-2">
                <div className="flex items-center gap-1.5 text-[10px] text-rose-200"><BrickWall size={11} /> <b>{t.speaker}</b></div>
                {peekWall && t.grounding?.wall && (
                  <div className="mt-1 border-t border-amber-400/20 pt-1 text-[10px] text-amber-200">
                    {t.grounding.wall.kind === "secret" ? <>正死守：「{t.grounding.wall.surface}」</> : <>误信「{t.grounding.wall.surface}」 → 真相：<b className="text-amber-100">「{t.grounding.wall.truth}」</b></>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {said.length === 0 && <div className="pt-2 text-center text-[10px] text-zinc-600">抛个尖锐的指控、让他们对撞——这里会标出谁被逼到墙角、谁的说法对不上。</div>}
      </div>
    </div>
  );
}
