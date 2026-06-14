import { useMemo, useState, useEffect } from "react";
import { Pencil, X, Save, RotateCcw, Sparkles } from "lucide-react";
import type { StoryGraph } from "@liumang/shared";
import { useUI } from "../store";

const TYPE_LABEL: Record<string, string> = { Event: "事件", Decision: "决定", Lie: "谎言", Reveal: "揭露", RelationChange: "关系", Outcome: "结局", Perception: "感知", Goal: "目标" };

/** P4b-1 直接编辑现有事件内容：改标题/摘要/结果 → updateEvents 补丁（仅会话） */
export default function EditNodePanel({ story }: { story: StoryGraph }) {
  const { editNodeId, draft, setEditNodeId, draftUpdateEvent, draftClearUpdate } = useUI();
  const ev = story.events.find((e) => e.id === editNodeId) ?? null;
  const existing = draft.updateEvents.find((u) => u.id === editNodeId)?.patch;
  // 当前显示值 = 原值 叠加 已有草稿补丁
  const cur = useMemo(() => (ev ? { ...ev, ...existing } : null), [ev, existing]);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [effect, setEffect] = useState("");
  useEffect(() => {
    if (!cur) return;
    setTitle(cur.title ?? "");
    setSummary(cur.summary ?? "");
    setEffect((cur as any).effect ?? "");
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [editNodeId]);

  if (!editNodeId || !ev || !cur) return null;

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
      <div className="w-[520px] max-w-[92%] rounded-2xl border border-sky-400/40 bg-ink-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
          <Pencil size={15} className="text-sky-300" />
          <div className="min-w-0 text-[11px] text-zinc-400">
            编辑事件 <span className="rounded bg-ink-700 px-1 text-[9px] text-zinc-300">{TYPE_LABEL[ev.type] ?? ev.type}</span> <b className="text-zinc-200">{ev.id}</b>
          </div>
          {existing && <span className="rounded bg-sky-400/90 px-1.5 py-0.5 text-[8px] font-bold text-ink-950">已改写</span>}
          <button onClick={() => setEditNodeId(null)} className="ml-auto text-zinc-500 hover:text-zinc-200"><X size={15} /></button>
        </div>

        <div className="space-y-2.5 px-4 py-3">
          <Field label="标题">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[12px] text-zinc-100 outline-none focus:border-sky-400/60" />
          </Field>
          <Field label="摘要（这一拍发生了什么）">
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className="w-full resize-none rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[11px] leading-relaxed text-zinc-300 outline-none focus:border-sky-400/60" />
          </Field>
          <Field label="结果 / 影响（埋下什么、改变了什么）">
            <textarea value={effect} onChange={(e) => setEffect(e.target.value)} rows={2} className="w-full resize-none rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[11px] leading-relaxed text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-sky-400/60" placeholder="（可选）" />
          </Field>
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
          <span className="ml-auto flex items-center gap-1 text-[9px] text-zinc-600"><Sparkles size={10} className="text-amber-300" /> 改完下游会标"波及"，可一键 AI 连锁改写</span>
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
