import { useEffect, useState } from "react";
import { Sparkles, Pencil, X, Trash2, ArrowRight, Plus } from "lucide-react";
import type { StoryGraph } from "@liumang/shared";
import { useUI } from "../store";
import { suggestInserts, type SuggestOption } from "../lib/api";

const TYPE_COLOR: Record<string, string> = { Event: "#60a5fa", Decision: "#a78bfa", Lie: "#fb7185", Reveal: "#34d399", RelationChange: "#f59e0b", Perception: "#94a3b8" };
const TYPE_LABEL: Record<string, string> = { Event: "事件", Decision: "决定", Lie: "谎言", Reveal: "揭露", RelationChange: "关系", Perception: "感知" };

export default function InsertPanel({ story }: { story: StoryGraph }) {
  const { pendingEdge, draft, applied, draftInsert, draftRemoveEdge, setPendingEdge } = useUI();
  const [tab, setTab] = useState<"ai" | "manual">("ai");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<SuggestOption[]>([]);
  const [err, setErr] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const from = pendingEdge?.from;
  const to = pendingEdge?.to;
  const A = story.events.find((e) => e.id === from);
  const B = story.events.find((e) => e.id === to);

  const gen = async () => {
    if (!from || !to) return;
    setLoading(true); setErr(false);
    try {
      const r = await suggestInserts(from, to);
      setOptions(r.options);
      if (!r.options.length) setErr(true);
    } catch { setErr(true); } finally { setLoading(false); }
  };
  // 按边重置 + AI 模式自动生成（避免换边后显示旧选项）
  useEffect(() => {
    setOptions([]); setErr(false);
    if (from && to && tab === "ai") gen();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [from, to, tab]);

  if (!pendingEdge || !A || !B) return null;

  const doInsert = (o: { title: string; summary: string; type: string; actors: string[] }) => {
    // 跨"应用"会话保持唯一：applied + 当前草稿 累计计数（避免 commit 后 id 撞车）
    const id = "EDRAFT" + (applied.addEvents.length + draft.addEvents.length + 1);
    draftInsert(
      { id, type: o.type, title: o.title, summary: o.summary, storyTime: A.storyTime, act: A.act, actOrd: A.actOrd, actors: (o.actors || []).map((c) => ({ char: c, role: "agent" })), facts: [], motive: "", effect: "" } as any,
      from!, to!
    );
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/50 backdrop-blur-sm" onClick={() => setPendingEdge(null)}>
      <div className="w-[520px] max-w-[92%] rounded-2xl border border-accent/40 bg-ink-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
          <Plus size={15} className="text-accent-soft" />
          <div className="min-w-0 text-[11px] text-zinc-400">
            在 <b className="text-zinc-200">{A.title.slice(0, 14)}</b> <ArrowRight size={10} className="inline" /> <b className="text-zinc-200">{B.title.slice(0, 14)}</b> 之间插入新剧情
          </div>
          <button onClick={() => setPendingEdge(null)} className="ml-auto text-zinc-500 hover:text-zinc-200"><X size={15} /></button>
        </div>

        <div className="flex gap-1 border-b border-ink-700 px-3 py-2">
          <Tab active={tab === "ai"} onClick={() => setTab("ai")} icon={<Sparkles size={12} />}>🪄 AI 编剧提议</Tab>
          <Tab active={tab === "manual"} onClick={() => setTab("manual")} icon={<Pencil size={12} />}>✍️ 自己写</Tab>
        </div>

        <div className="max-h-[52vh] min-h-[140px] overflow-y-auto px-4 py-3">
          {tab === "ai" ? (
            loading ? (
              <div className="flex flex-col items-center gap-2 py-8 text-[12px] text-accent-soft">
                <span className="relative"><Sparkles size={26} className="animate-pulse" /><span className="absolute -right-1 -top-1 text-amber-300">✦</span></span>
                AI 编剧构思中…（按前因后果生成合理选项）
              </div>
            ) : err ? (
              <div className="py-6 text-center text-[11px] text-zinc-500">生成失败或无选项。<button onClick={gen} className="text-accent-soft underline">重试</button></div>
            ) : (
              <div className="space-y-2">
                {options.map((o, i) => (
                  <button key={i} onClick={() => doInsert(o)} className="block w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-left transition-colors hover:border-accent/60 hover:bg-accent/5">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded px-1 py-0.5 text-[8px] font-medium" style={{ background: `${TYPE_COLOR[o.type] ?? "#60a5fa"}22`, color: TYPE_COLOR[o.type] ?? "#60a5fa" }}>{TYPE_LABEL[o.type] ?? o.type}</span>
                      <span className="text-[12px] font-medium text-zinc-100">{o.title}</span>
                      <Plus size={12} className="ml-auto text-zinc-600" />
                    </div>
                    <div className="mt-1 text-[10.5px] leading-relaxed text-zinc-400">{o.summary}</div>
                    {o.actors.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{o.actors.map((a) => <span key={a} className="rounded bg-ink-700 px-1 text-[8.5px] text-zinc-400">{a}</span>)}</div>}
                  </button>
                ))}
                <button onClick={gen} className="w-full rounded-lg border border-dashed border-ink-700 py-1.5 text-[10px] text-zinc-500 hover:text-zinc-300">↻ 换一批</button>
              </div>
            )
          ) : (
            <div className="space-y-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="新剧情事件标题…" className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60" />
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="一句话说明（可选）" rows={2} className="w-full resize-none rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-[11px] text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-accent/60" />
              <button disabled={!title.trim()} onClick={() => doInsert({ title: title.trim(), summary: summary.trim(), type: "Event", actors: [] })} className="w-full rounded-lg bg-accent/80 py-2 text-[12px] text-white transition-colors hover:bg-accent disabled:opacity-40">插入这段剧情</button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-ink-700 px-4 py-2">
          <button onClick={() => draftRemoveEdge(from!, to!)} className="flex items-center gap-1 rounded-lg border border-rose-400/40 px-2.5 py-1.5 text-[10.5px] text-rose-200 hover:bg-rose-500/10"><Trash2 size={12} /> 删除这条因果（看下游崩不崩）</button>
          <span className="ml-auto text-[9px] text-zinc-600">AI 只提议，影响范围与是否自洽由引擎+求解器判</span>
        </div>
      </div>
    </div>
  );
}

function Tab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button onClick={onClick} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] transition-colors ${active ? "bg-accent/20 text-accent-soft" : "text-zinc-400 hover:text-zinc-200"}`}>{icon}{children}</button>;
}
