import { useMemo, useState, useEffect } from "react";
import { Pencil, X, Save, RotateCcw, Sparkles, Wand2, Loader2 } from "lucide-react";
import type { StoryGraph } from "@liumang/shared";
import { useUI } from "../store";
import { suggestEdit, type EditOption } from "../lib/api";

const TYPE_LABEL: Record<string, string> = { Event: "事件", Decision: "决定", Lie: "谎言", Reveal: "揭露", RelationChange: "关系", Outcome: "结局", Perception: "感知", Goal: "目标" };

/** P4b-1 直接编辑现有事件内容：改标题/摘要/结果 → updateEvents 补丁（仅会话）。带 AI 提议改法。 */
export default function EditNodePanel({ story }: { story: StoryGraph }) {
  const { editNodeId, draft, setEditNodeId, draftUpdateEvent, draftClearUpdate } = useUI();
  const ev = story.events.find((e) => e.id === editNodeId) ?? null;
  const existing = draft.updateEvents.find((u) => u.id === editNodeId)?.patch;
  const cur = useMemo(() => (ev ? { ...ev, ...existing } : null), [ev, existing]);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [effect, setEffect] = useState("");
  // AI 提议
  const [aiOpen, setAiOpen] = useState(false);
  const [direction, setDirection] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOptions, setAiOptions] = useState<EditOption[]>([]);
  const [aiErr, setAiErr] = useState(false);

  useEffect(() => {
    if (!cur) return;
    setTitle(cur.title ?? "");
    setSummary(cur.summary ?? "");
    setEffect((cur as any).effect ?? "");
    setAiOpen(false); setAiOptions([]); setDirection(""); setAiErr(false);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [editNodeId]);

  if (!editNodeId || !ev || !cur) return null;

  const gen = async () => {
    setAiLoading(true); setAiErr(false);
    try {
      const r = await suggestEdit(ev.id, direction.trim() || undefined);
      setAiOptions(r.options);
      if (!r.options.length) setAiErr(true);
    } catch { setAiErr(true); } finally { setAiLoading(false); }
  };
  const applyOption = (o: EditOption) => { setTitle(o.title || title); setSummary(o.summary || summary); if (o.effect) setEffect(o.effect); };

  const dirty = title.trim() !== (ev.title ?? "") || summary.trim() !== (ev.summary ?? "") || effect.trim() !== ((ev as any).effect ?? "");
  const save = () => {
    const patch: Record<string, string> = {};
    if (title.trim() !== (ev.title ?? "")) patch.title = title.trim();
    if (summary.trim() !== (ev.summary ?? "")) patch.summary = summary.trim();
    if (effect.trim() !== ((ev as any).effect ?? "")) patch.effect = effect.trim();
    if (Object.keys(patch).length) draftUpdateEvent(ev.id, patch);
    setEditNodeId(null);
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/50 backdrop-blur-sm" onClick={() => setEditNodeId(null)}>
      <div className="flex max-h-[88vh] w-[540px] max-w-[92%] flex-col rounded-2xl border border-sky-400/40 bg-ink-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
          <Pencil size={15} className="text-sky-300" />
          <div className="min-w-0 text-[11px] text-zinc-400">
            编辑事件 <span className="rounded bg-ink-700 px-1 text-[9px] text-zinc-300">{TYPE_LABEL[ev.type] ?? ev.type}</span> <b className="text-zinc-200">{ev.id}</b>
          </div>
          {existing && <span className="rounded bg-sky-400/90 px-1.5 py-0.5 text-[8px] font-bold text-ink-950">已改写</span>}
          <button onClick={() => setEditNodeId(null)} className="ml-auto text-zinc-500 hover:text-zinc-200"><X size={15} /></button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          <Field label="标题">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[12px] text-zinc-100 outline-none focus:border-sky-400/60" />
          </Field>
          <Field label="摘要（这一拍发生了什么）">
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[11px] leading-relaxed text-zinc-300 outline-none focus:border-sky-400/60" />
          </Field>
          <Field label="结果 / 影响（埋下什么、改变了什么）">
            <textarea value={effect} onChange={(e) => setEffect(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[11px] leading-relaxed text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-sky-400/60" placeholder="（可选）" />
          </Field>

          <div className="rounded-lg border border-amber-400/30 bg-amber-400/5">
            <button onClick={() => { setAiOpen((v) => !v); if (!aiOpen && !aiOptions.length && !aiLoading) gen(); }} className="flex w-full items-center gap-1.5 px-3 py-2 text-[11px] text-amber-200">
              <Wand2 size={13} /> <b>AI 帮我改这一拍</b>
              <span className="text-[9px] text-amber-300/70">给个方向，或直接让 AI 给几种改法</span>
              <span className="ml-auto text-amber-300/60">{aiOpen ? "▾" : "▸"}</span>
            </button>
            {aiOpen && (
              <div className="space-y-2 px-3 pb-3">
                <div className="flex gap-1.5">
                  <input value={direction} onChange={(e) => setDirection(e.target.value)} onKeyDown={(e) => e.key === "Enter" && gen()} placeholder="想怎么改？例：把电台改成两族和解（留空=AI给方向）" className="flex-1 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-[10.5px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-400/50" />
                  <button onClick={gen} disabled={aiLoading} className="rounded-lg bg-amber-400/80 px-2.5 py-1.5 text-[10.5px] font-medium text-ink-950 hover:bg-amber-400 disabled:opacity-50">生成</button>
                </div>
                {aiLoading ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-amber-200"><Loader2 size={14} className="animate-spin" /> AI 编剧构思改法中…</div>
                ) : aiErr ? (
                  <div className="py-3 text-center text-[10px] text-zinc-500">没生成出来，<button onClick={gen} className="text-amber-300 underline">重试</button></div>
                ) : (
                  aiOptions.map((o, i) => (
                    <button key={i} onClick={() => applyOption(o)} className="block w-full rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2 text-left transition-colors hover:border-amber-400/60 hover:bg-amber-400/5">
                      <div className="flex items-center gap-1.5">
                        {o.angle && <span className="rounded bg-amber-400/20 px-1 py-0.5 text-[8px] font-medium text-amber-200">{o.angle}</span>}
                        <span className="text-[11px] font-medium text-zinc-100">{o.title}</span>
                        <span className="ml-auto text-[9px] text-amber-300/70">填入 ↑</span>
                      </div>
                      <div className="mt-1 text-[10px] leading-relaxed text-zinc-400">{o.summary}</div>
                      {o.effect && <div className="mt-0.5 text-[9px] text-zinc-500">→ {o.effect}</div>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {ev.actors.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-[9px] text-zinc-500">
              <span>涉及：</span>
              {ev.actors.map((a) => <span key={a.char} className="rounded bg-ink-700 px-1 text-zinc-400">{a.char}</span>)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-ink-700 px-4 py-2.5">
          {existing && (
            <button onClick={() => { draftClearUpdate(ev.id); setEditNodeId(null); }} className="flex items-center gap-1 rounded-lg border border-ink-700 px-2.5 py-1.5 text-[10.5px] text-zinc-300 hover:border-rose-400/50 hover:text-rose-200"><RotateCcw size={12} /> 撤销此改写</button>
          )}
          <span className="ml-auto flex items-center gap-1 text-[9px] text-zinc-600"><Sparkles size={10} className="text-amber-300" /> 保存后下游会标"波及"，可一键 AI 连锁改写</span>
          <button disabled={!dirty} onClick={save} className="flex items-center gap-1 rounded-lg bg-sky-500/80 px-3 py-1.5 text-[11px] text-white transition-colors hover:bg-sky-500 disabled:opacity-40"><Save size={12} /> 保存改写</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[9.5px] font-medium text-zinc-500">{label}</div>
      {children}
    </div>
  );
}
