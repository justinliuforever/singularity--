import { useState, useEffect } from "react";
import { Eye, EyeOff, BookOpen, Target, Brain, MessageCircle, ScrollText, ChevronDown } from "lucide-react";
import { fetchCharacter, type Dossier as Dos, type Clue } from "../lib/api";
import type { Slice } from "@liumang/shared";
import { useUI } from "../store";
import ChatPanel from "./ChatPanel";
import Markdownish from "./Markdownish";

const TABS = [
  { k: "概览", icon: BookOpen },
  { k: "线索", icon: ScrollText },
  { k: "认知", icon: Brain },
  { k: "本幕", icon: Target },
  { k: "审问", icon: MessageCircle },
] as const;

export default function Dossier({ character, actName, act, slice, portrait }: { character: string; actName: string; act: number; slice: Slice; portrait?: string | null }) {
  const [tab, setTab] = useState<string>("线索");
  const [d, setD] = useState<Dos | null>(null);
  const { peekWall: peek, set } = useUI();

  useEffect(() => {
    setD(null);
    fetchCharacter(character, actName).then(setD).catch(() => {});
  }, [character, actName]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-ink-700 px-4 py-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-ink-700 ring-2 ring-rose-400/50">
          {portrait ? <img src={portrait} className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-zinc-400">{character.slice(0, 1)}</div>}
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-zinc-100">{character}</div>
          <div className="truncate text-[10px] text-zinc-500">{d?.aliases?.slice(0, 4).join(" · ") || "…"}</div>
        </div>
        <div className="ml-auto text-right text-[10px]">
          <div className="text-zinc-500">{actName}</div>
          <div>
            <span className="text-know">知 {slice.stats.knownFacts}</span>
            <span className="text-zinc-600"> / </span>
            <span className="text-rose-300">墙后 {slice.stats.hidden}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 border-b border-ink-700">
        {TABS.map(({ k, icon: Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex flex-1 items-center justify-center gap-1 py-2 text-[11px] transition-colors ${tab === k ? "border-b-2 border-accent text-accent-soft" : "text-zinc-500 hover:text-zinc-300"}`}
          >
            <Icon size={12} /> {k}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {tab === "审问" ? (
          <ChatPanel character={character} actName={actName} slice={slice} />
        ) : (
          <div className="h-full overflow-y-auto px-4 py-3">
            {!d && <div className="animate-pulse text-[11px] text-zinc-600">加载档案…</div>}
            {d && tab === "概览" && (
              <div className="space-y-3 text-[11px]">
                {d.coreTheme && (
                  <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2">
                    <div className="mb-0.5 text-[10px] text-accent-soft">核心命题 · 角色弧线</div>
                    <div className="leading-relaxed text-zinc-200">{d.coreTheme}</div>
                  </div>
                )}
                <Section title="人设">
                  <Markdownish text={d.persona} />
                </Section>
                <Section title={`关系（${d.relations.length}）`}>
                  <div className="space-y-1">
                    {d.relations.map((r, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="shrink-0 rounded bg-ink-700 px-1.5 text-[9px] text-accent-soft">{r.type || "rel"}</span>
                        <span className="text-zinc-300">
                          <b className="text-zinc-100">{r.target}</b>
                          {r.subtype && <span className="text-zinc-500"> — {r.subtype}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}
            {d && tab === "线索" && <ClueList clues={d.clues} act={act} />}
            {d && tab === "本幕" && (
              <div className="space-y-3">
                <Section title="本幕目标 / 你需要做到">
                  <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300">{d.goals || "（本幕无显式目标）"}</div>
                </Section>
                <Section title="本幕感知到的线索 / 演绎">
                  <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-300">{d.perceives || "（无）"}</div>
                </Section>
                <Section title="本幕沉浸剧本（节选）">
                  {d.narrative ? <Markdownish text={d.narrative} /> : <div className="text-[11px] text-zinc-600">（本幕正文见「幕档案」）</div>}
                </Section>
              </div>
            )}
            {d && tab === "认知" && (
              <div className="space-y-3 text-[11px]">
                <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-850 px-3 py-2">
                  <div className="text-zinc-400">
                    认知边界：<span className="text-know">{d.knownCount} 知</span> · <span className="text-rose-300">{d.falseCount} 误信</span> · <span className="text-amber-300">{d.secrets.length} 守秘</span>
                  </div>
                  <button
                    onClick={() => set({ peekWall: !peek })}
                    className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] transition-colors ${peek ? "bg-amber-500/20 text-amber-200" : "bg-ink-700 text-zinc-400 hover:text-zinc-200"}`}
                  >
                    {peek ? <Eye size={11} /> : <EyeOff size={11} />} 窥视墙后
                  </button>
                </div>
                {peek && <div className="rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200/80">创作者模式：下方显示 TA 假信念背后的上帝视角真相（TA 本人永远看不到）。</div>}
                <Section title="信念（真 / 误信）">
                  <div className="space-y-1.5">
                    {d.beliefs.map((b, i) => (
                      <div key={i} className={`rounded-md border px-2 py-1.5 ${b.true ? "border-ink-700 bg-ink-850" : "border-rose-400/40 bg-rose-500/10"}`}>
                        <div className="flex gap-1.5">
                          <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${b.true ? "bg-know" : "bg-truthlie"}`} />
                          <span className={b.true ? "text-zinc-300" : "text-rose-100"}>
                            {!b.true && <span className="mr-1 rounded bg-rose-500/30 px-1 text-[9px] text-rose-100">误信</span>}
                            {b.statement}
                          </span>
                        </div>
                        {!b.true && peek && b.truth && (
                          <div className="mt-1 border-t border-rose-400/20 pt-1 text-[10px] text-amber-200/90">🔒 真相：{b.truth}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
                <Section title={`必须守住的秘密（${d.secrets.length}）`}>
                  <div className="space-y-1">
                    {d.secrets.map((s, i) => (
                      <div key={i} className="rounded bg-amber-500/5 px-2 py-1 text-amber-100/90">
                        🔒 {s.fact}
                        {s.reveal_if && <span className="text-zinc-500"> · 触发：{s.reveal_if}</span>}
                      </div>
                    ))}
                  </div>
                </Section>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** 本幕手上的线索：DM 在某幕发给 TA 的实体道具卡 + 真实卡面内容（OCR） */
function ClueList({ clues, act }: { clues: Clue[]; act: number }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const got = clues.filter((c) => c.actOrd <= act);
  const future = clues.filter((c) => c.actOrd > act);

  if (!clues.length) return <div className="text-[11px] text-zinc-600">（本角色暂无关联线索）</div>;

  return (
    <div className="space-y-3 text-[11px]">
      <div className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-zinc-400">
        到<span className="text-accent-soft">{actLabel(act)}</span>为止，DM 发给 TA <span className="text-reveal">{got.length}</span> 张线索卡
        {future.length > 0 && <span className="text-zinc-600"> · 后续还有 {future.length} 张</span>}
      </div>
      <div className="space-y-1.5">
        {got.map((c) => {
          const isNew = c.actOrd === act;
          const isOpen = open.has(c.id);
          return (
            <div key={c.id} className={`overflow-hidden rounded-lg border ${isNew ? "border-accent/50 bg-accent/5" : "border-ink-700 bg-ink-850"}`}>
              <button onClick={() => toggle(c.id)} className="flex w-full items-start gap-2 px-2.5 py-2 text-left">
                <ScrollText size={13} className={`mt-0.5 shrink-0 ${isNew ? "text-accent-soft" : "text-zinc-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1">
                    {isNew && <span className="rounded bg-accent/25 px-1 text-[8px] text-accent-soft">本幕新发</span>}
                    <span className="rounded bg-ink-700 px-1 text-[8px] text-zinc-400">{c.actName}</span>
                    <span className="rounded bg-emerald-500/10 px-1 text-[8px] text-emerald-300">{c.type}</span>
                    <span className="text-[8px] text-zinc-600">难度{c.difficulty}</span>
                  </div>
                  <div className="mt-0.5 truncate text-zinc-200">{c.title}</div>
                </div>
                <ChevronDown size={13} className={`mt-0.5 shrink-0 text-zinc-600 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-ink-700 px-2.5 py-2">
                  {c.showCondition && <div className="mb-1.5 text-[9px] text-zinc-500">出示：{c.showCondition}</div>}
                  {c.relatedChars.length > 1 && (
                    <div className="mb-1.5 text-[9px] text-zinc-500">共享：{c.relatedChars.join("、")}</div>
                  )}
                  {c.content ? (
                    <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-ink-900 px-2 py-1.5 font-sans text-[10px] leading-relaxed text-zinc-300">{c.content}</pre>
                  ) : (
                    <div className="text-[10px] text-zinc-600">（这张是纯视觉道具，无文字内容；原件见来源 PDF）</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {future.length > 0 && (
        <div className="space-y-1 border-t border-ink-700 pt-2 opacity-50">
          <div className="text-[9px] uppercase tracking-wide text-zinc-600">尚未发放（后续幕）</div>
          {future.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 text-[10px] text-zinc-600">
              <span className="rounded bg-ink-800 px-1 text-[8px]">{c.actName}</span>
              <span className="truncate">{c.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ACT_LABELS = ["开本前", "序幕", "第一幕", "第二幕", "第三幕", "第四幕", "第五幕", "第六幕", "第七幕", "无声之旅", "无所容心", "第十幕", "结局"];
const actLabel = (ord: number) => ACT_LABELS[ord] ?? `第${ord}幕`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">{title}</div>
      {children}
    </div>
  );
}
