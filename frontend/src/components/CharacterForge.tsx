import { useState } from "react";
import { X, UserPlus, Loader2, Sparkles, Target, HeartCrack, Lock, AlertTriangle, Lightbulb, Link2, Clapperboard, RotateCcw, ShieldCheck, Check, Network, Trash2 } from "lucide-react";
import { suggestCharacter, type SuggestCharResult } from "../lib/api";
import { useUI } from "../store";

/**
 * B1 · 加人物 · 命名充实
 * 作者起名(+方向) → LLM 在阴谋网里把 ta 充实成主角量级的人（稠密关系 + 因果锚定的剧情线）
 * → 引擎框定 → 富草稿预览 + 关系线可视化。采纳后落进关系网 + 故事图。仅会话、不落盘。
 */
const EVTYPE: Record<string, { l: string; c: string }> = {
  Event: { l: "事件", c: "#60a5fa" }, Decision: { l: "决定", c: "#a78bfa" }, Lie: { l: "谎言", c: "#fb7185" },
  Reveal: { l: "揭露", c: "#34d399" }, RelationChange: { l: "关系", c: "#f59e0b" }, Outcome: { l: "结局", c: "#22d3ee" },
  Perception: { l: "感知", c: "#94a3b8" }, Goal: { l: "目标", c: "#c084fc" },
};
export default function CharacterForge({ onClose }: { onClose: () => void }) {
  const { sessionChars, acceptChar, removeSessionChar, set } = useUI();
  const [name, setName] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<SuggestCharResult | null>(null);
  const [err, setErr] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const run = async () => {
    if (loading) return;
    setLoading(true); setErr(false); setAccepted(false);
    // 避免重名：已采纳的会话角色 + 上一版生成的名字（没指定名字时，"换一版"才能换出新名）
    const avoid = [...sessionChars.map((c) => c.name), ...(!name.trim() && res ? [res.draft.name] : [])];
    try { setRes(await suggestCharacter(name.trim(), hint.trim(), avoid)); }
    catch { setErr(true); }
    finally { setLoading(false); }
  };

  const d = res?.draft;
  const okRels = d ? d.relations.filter((r) => r.exists).length : 0;
  const nEvents = d ? d.storyEvents.length : 0;
  const dup = d ? res!.cast.includes(d.name) : false;
  const alreadyIn = d ? sessionChars.some((c) => c.name === d.name) : false;
  const canAccept = !!d && okRels > 0 && !dup;
  const accept = () => { if (!d || !canAccept) return; acceptChar(d); setAccepted(true); };
  const goNet = () => { set({ mode: "scene", perspective: "god", liveStage: false }); onClose(); };

  return (
    <div className="absolute inset-0 z-30 flex justify-center bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <div className="mt-6 flex h-[calc(100%-3rem)] w-[760px] max-w-[94%] flex-col rounded-t-2xl border border-ink-700 bg-ink-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
          <UserPlus size={16} className="text-accent-soft" />
          <div className="text-[13px] font-semibold text-zinc-100">加人物 · 命名充实</div>
          <span className="text-[10px] text-zinc-500">起个名(+方向) → AI 在阴谋网里把 ta 充实成有戏的人 · 关系只连真人 · 事件落合法幕</span>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-200"><X size={15} /></button>
        </div>

        {sessionChars.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-ink-700 bg-emerald-500/5 px-4 py-1.5 text-[10px]">
            <span className="text-emerald-300/90">本会话已落进关系网（{sessionChars.length}）：</span>
            {sessionChars.map((c) => (
              <span key={c.name} className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-200">
                ＋{c.name}
                <button onClick={() => removeSessionChar(c.name)} className="text-emerald-300/60 hover:text-rose-300" title="移除"><Trash2 size={9} /></button>
              </span>
            ))}
            <button onClick={goNet} className="ml-auto flex items-center gap-1 rounded border border-emerald-400/40 px-1.5 py-0.5 text-emerald-200 hover:bg-emerald-500/10"><Network size={10} /> 去关系网看</button>
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-850/50 px-4 py-2.5">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="角色名（可留空让 AI 起名）"
            className="w-44 rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-accent/60" />
          <input value={hint} onChange={(e) => setHint(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="方向 / 定位（可留空，例：怒河安插在缪宏谟身边的暗桩）"
            className="flex-1 rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-accent/60" />
          <button onClick={run} disabled={loading} className="flex items-center gap-1.5 rounded-lg bg-accent/80 px-3 py-1.5 text-[12px] text-white hover:bg-accent disabled:opacity-50">
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {res ? "重新生成" : "生成"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!res && !loading && !err && (
            <div className="grid h-full place-items-center text-center text-[12px] text-zinc-500">
              <div>
                <UserPlus size={30} className="mx-auto mb-3 text-ink-600" />
                给个名字或一句定位，AI 会把这个角色"长"进现有阴谋网——<br />有 want≠need 的撕扯、守的秘密、与现有人物的羁绊、卷入的事件。
                <div className="mt-2 text-[10px] text-zinc-600">不写本子、仅本次会话；求解器盖章是下一程。</div>
              </div>
            </div>
          )}
          {loading && !res && <div className="flex h-full items-center justify-center gap-2 text-[12px] text-accent-soft"><Loader2 size={16} className="animate-spin" /> AI 正在把 ta 织进阴谋网…（人设/动机/秘密/关系/卷入事件）</div>}
          {err && <div className="flex h-full items-center justify-center text-[12px] text-rose-300">生成失败，<button onClick={run} className="ml-1 underline">重试</button></div>}

          {d && (
            <div className={`space-y-3.5 ${loading ? "opacity-50" : ""}`}>
              <div className="rounded-xl border border-accent/40 bg-accent/5 px-3.5 py-2.5">
                <div className="flex items-baseline gap-2">
                  <b className="text-[15px] text-zinc-50">{d.name}</b>
                  <span className="text-[10px] text-zinc-500">新角色 · 草稿</span>
                </div>
                {d.persona && <div className="mt-1 text-[11.5px] leading-relaxed text-zinc-300">{d.persona}</div>}
                {d.hook && <div className="mt-1.5 flex items-start gap-1 text-[11px] text-accent-soft"><Sparkles size={12} className="mt-0.5 shrink-0" /> {d.hook}</div>}
              </div>

              {/* 动机三角 want→need→conflict */}
              <div className="grid grid-cols-3 gap-2">
                <Cell icon={Target} color="#34d399" label="想要 (want)" text={d.want} />
                <Cell icon={HeartCrack} color="#f59e0b" label="真正缺 (need)" text={d.need} />
                <Cell icon={AlertTriangle} color="#fb7185" label="撕扯 (conflict)" text={d.conflict} />
              </div>

              {/* 秘密 + 误信（审问破绽） */}
              <div className="grid grid-cols-2 gap-2">
                {d.secret && (
                  <div className="rounded-lg border border-rose-400/30 bg-rose-500/5 px-3 py-2 text-[11px]">
                    <div className="mb-0.5 flex items-center gap-1 font-medium text-rose-200"><Lock size={11} /> 守的秘密</div>
                    <div className="leading-relaxed text-zinc-300">{d.secret}</div>
                  </div>
                )}
                {d.falseBelief && (d.falseBelief.belief || d.falseBelief.truth) && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[11px]">
                    <div className="mb-0.5 flex items-center gap-1 font-medium text-amber-200"><AlertTriangle size={11} /> 误信（破绽）</div>
                    <div className="leading-relaxed text-zinc-300">信「{d.falseBelief.belief}」</div>
                    <div className="leading-relaxed text-amber-200/90">真「<b className="text-amber-100">{d.falseBelief.truth}</b>」</div>
                  </div>
                )}
              </div>

              {/* 知道的关键真相 */}
              {d.knows.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1 text-[10.5px] font-medium text-zinc-300"><Lightbulb size={12} className="text-emerald-300" /> 知道的关键真相（{d.knows.length}）</div>
                  <div className="space-y-1">
                    {d.knows.map((k, i) => <div key={i} className="rounded border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11px] leading-relaxed text-zinc-300">{k}</div>)}
                  </div>
                </div>
              )}

              {/* 关系网：列表 + 迷你关系线图 */}
              {d.relations.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1 text-[10.5px] font-medium text-zinc-300"><Link2 size={12} className="text-accent-soft" /> 与现有人物的关系（{d.relations.length}） <span className="text-[9px] text-zinc-600">✓=连上真人 · 待核=名字不在册</span></div>
                  <div className="grid grid-cols-[200px_1fr] gap-3">
                    <RelDiagram center={d.name} rels={d.relations} />
                    <div className="space-y-1.5">
                      {d.relations.map((r, i) => (
                        <div key={i} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${r.exists ? "border-ink-700 bg-ink-850" : "border-amber-400/40 bg-amber-400/5"}`}>
                          <div className="flex items-center gap-1.5">
                            <b className="text-zinc-100">{r.target}</b>
                            <span className="rounded bg-accent/20 px-1 py-0.5 text-[8.5px] text-accent-soft">{r.type}</span>
                            {!r.exists && <span className="rounded bg-amber-400/20 px-1 py-0.5 text-[8.5px] text-amber-200">待核</span>}
                          </div>
                          <div className="mt-0.5 leading-relaxed text-zinc-400">{r.why}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 剧情线：带类型 + 因果锚定（落进故事图的就是这些） */}
              {d.storyEvents.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center gap-1 text-[10.5px] font-medium text-zinc-300">
                    <Clapperboard size={12} className="text-sky-300" /> 剧情线（{d.storyEvents.length}）<span className="text-[9px] text-zinc-600">采纳后落进故事图 · 接进现有因果</span>
                  </div>
                  <div className="space-y-1.5">
                    {d.storyEvents.map((s, i) => {
                      const tc = EVTYPE[s.type] ?? EVTYPE.Event;
                      return (
                        <div key={i} className="rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-[11px]">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded px-1 py-0.5 text-[8.5px] font-bold" style={{ background: `${tc.c}22`, color: tc.c }}>{tc.l}</span>
                            <span className={`rounded px-1 py-0.5 text-[8.5px] ${s.actOk ? "bg-sky-400/15 text-sky-200" : "bg-amber-400/20 text-amber-200"}`}>{s.act || "未定幕"}{!s.actOk && "·待核"}</span>
                            <b className="text-zinc-100">{s.title}</b>
                          </div>
                          <div className="mt-0.5 leading-relaxed text-zinc-400">{s.summary}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9.5px] text-zinc-500">
                            {s.afterTitle && <span className="text-accent-soft">↳ 接在「{s.afterTitle}」之后</span>}
                            {s.leadsToTitle && <span className="text-emerald-300/90">→ 促成「{s.leadsToTitle}」</span>}
                            {s.withChars.length > 0 && <span>同场：{s.withChars.join("、")}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {res!.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[10.5px] text-amber-200">
                  <div className="mb-0.5 flex items-center gap-1 font-medium"><AlertTriangle size={11} /> 引擎框定（{res!.warnings.length}）</div>
                  {res!.warnings.map((w, i) => <div key={i} className="leading-relaxed">· {w}</div>)}
                </div>
              )}
            </div>
          )}
        </div>

        {d && (
          <div className="flex items-center gap-2 border-t border-ink-700 px-4 py-2.5">
            {accepted || alreadyIn ? (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-300"><Check size={13} /> 「{d.name}」已落进关系网（{okRels} 关系线）+ 故事图（{nEvents} 段剧情）· 仅本会话</span>
            ) : (
              <span className="flex items-center gap-1 text-[9.5px] text-zinc-600">
                <ShieldCheck size={11} className="text-emerald-300" />
                {okRels > 0 ? `${okRels} 条关系连到在册真人、${nEvents} 段剧情接进现有因果，可采纳。` : "没有连上在册真人的关系——换个方向再生成。"}
                {dup && <span className="ml-1 text-amber-300">· 与现有角色重名，请改名</span>}
              </span>
            )}
            <button onClick={run} className="ml-auto flex items-center gap-1 rounded-lg border border-ink-700 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:border-accent/50 hover:text-white"><RotateCcw size={12} /> 换一版</button>
            {accepted || alreadyIn ? (
              <>
                <button onClick={onClose} className="flex items-center gap-1 rounded-lg border border-teal-400/50 bg-teal-500/10 px-2.5 py-1.5 text-[11px] text-teal-200 hover:bg-teal-500/20"><Clapperboard size={12} /> 看故事图</button>
                <button onClick={goNet} className="flex items-center gap-1 rounded-lg bg-emerald-500/80 px-3 py-1.5 text-[11px] text-white hover:bg-emerald-500"><Network size={12} /> 去关系网</button>
              </>
            ) : (
              <button onClick={accept} disabled={!canAccept} className="flex items-center gap-1 rounded-lg bg-accent/80 px-3 py-1.5 text-[11px] text-white hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40" title={canAccept ? "落进关系网 + 故事图（仅本会话）" : "需要至少一条连到在册真人的关系"}><UserPlus size={12} /> 采纳 · 落进关系网 + 故事图</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ icon: Icon, color, label, text }: { icon: typeof Target; color: string; label: string; text: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2">
      <div className="mb-0.5 flex items-center gap-1 text-[10px] font-medium" style={{ color }}><Icon size={11} /> {label}</div>
      <div className="text-[11px] leading-relaxed text-zinc-300">{text || "—"}</div>
    </div>
  );
}

/** 迷你关系线图：新角色居中，向各 target 连线（✓实线accent / 待核虚线amber） */
function RelDiagram({ center, rels }: { center: string; rels: { target: string; exists: boolean }[] }) {
  const W = 200, H = Math.max(150, rels.length * 38 + 20);
  const cx = 52, cy = H / 2;
  return (
    <svg width={W} height={H} className="rounded-lg border border-ink-700 bg-ink-950/40">
      {rels.map((r, i) => {
        const ty = 24 + (i * (H - 48)) / Math.max(1, rels.length - 1 || 1);
        const tx = W - 56;
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={tx} y2={ty} stroke={r.exists ? "#a78bfa" : "#f59e0b"} strokeWidth={1.3} strokeDasharray={r.exists ? "" : "3 3"} opacity={0.7} />
            <circle cx={tx} cy={ty} r={4} fill={r.exists ? "#a78bfa" : "#f59e0b"} />
            <text x={tx + 8} y={ty + 3} fill="#a1a1aa" fontSize="9">{r.target.slice(0, 5)}</text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={7} fill="#34d399" />
      <text x={cx} y={cy + 20} fill="#e4e4e7" fontSize="9.5" textAnchor="middle" fontWeight="bold">{center.slice(0, 4)}</text>
    </svg>
  );
}
