import { useEffect, useRef, useState } from "react";
import { Wand2, X, Loader2, Check, Trash2, ArrowRight, ShieldCheck, CornerDownRight } from "lucide-react";
import type { StoryGraph } from "@liumang/shared";
import { useUI } from "../store";
import { cascadeRewrite, type CascadeRewrite } from "../lib/api";

/** P4b · 下游连锁改写抽屉：改完上游，AI 逐个提议下游怎么跟着改；接受 → 进草稿 → 求解器重新盖章 */
export default function CascadeDrawer({ story }: { story: StoryGraph }) {
  const { cascadeOpen, draft, applied, setCascadeOpen, draftUpdateEvent, draftClearUpdate, draftDeleteEvent, draftUndeleteEvent } = useUI();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CascadeRewrite[]>([]);
  const [capped, setCapped] = useState<number | undefined>();
  const [err, setErr] = useState(false);
  const fetchedFor = useRef<string>("");

  useEffect(() => {
    if (!cascadeOpen) return;
    // 仅在打开时抓一次（按当时草稿）；接受改写会改 draft，但不重抓，避免提议漂移
    const key = JSON.stringify({ a: draft.addEvents.map((e) => e.id), r: draft.removeEventIds, e: draft.removeEdges, u: draft.updateEvents.map((u) => u.id) });
    if (fetchedFor.current === key) return;
    fetchedFor.current = key;
    setLoading(true); setErr(false); setRows([]);
    cascadeRewrite({ addEvents: draft.addEvents, addEdges: draft.addEdges, removeEventIds: draft.removeEventIds, removeEdges: draft.removeEdges, updateEvents: draft.updateEvents }, applied)
      .then((r) => { setRows(r.rewrites); setCapped(r.capped); })
      .catch(() => setErr(true))
      .finally(() => setLoading(false));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [cascadeOpen]);

  if (!cascadeOpen) return null;

  const oldSummary = (id: string) => story.events.find((e) => e.id === id)?.summary ?? "";
  const isAcceptedRewrite = (r: CascadeRewrite) => draft.updateEvents.some((u) => u.id === r.id);
  const isAcceptedDrop = (id: string) => draft.removeEventIds.includes(id);

  const acceptRewrite = (r: CascadeRewrite) => draftUpdateEvent(r.id, { ...(r.newSummary ? { summary: r.newSummary } : {}), ...(r.newEffect ? { effect: r.newEffect } : {}) });
  const actionable = rows.filter((r) => r.action !== "keep");
  const keeps = rows.filter((r) => r.action === "keep");
  const acceptedCount = actionable.filter((r) => (r.action === "drop" ? isAcceptedDrop(r.id) : isAcceptedRewrite(r))).length;

  const acceptAll = () => actionable.forEach((r) => (r.action === "drop" ? draftDeleteEvent(r.id) : acceptRewrite(r)));

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/55 backdrop-blur-sm" onClick={() => setCascadeOpen(false)}>
      <div className="flex max-h-[82vh] w-[660px] max-w-[94%] flex-col rounded-2xl border border-amber-400/40 bg-ink-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* 头 */}
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
          <Wand2 size={16} className="text-amber-300" />
          <div className="text-[12px] font-semibold text-zinc-100">下游连锁改写</div>
          <span className="text-[10px] text-zinc-500">改完上游 · AI 提议下游怎么跟着改</span>
          <button onClick={() => setCascadeOpen(false)} className="ml-auto text-zinc-500 hover:text-zinc-200"><X size={15} /></button>
        </div>

        {/* 体 */}
        <div className="min-h-[160px] flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-[12px] text-amber-200">
              <span className="relative"><Wand2 size={28} className="animate-pulse" /><span className="absolute -right-1 -top-1 animate-ping text-amber-300">✦</span></span>
              AI 编剧通读因果链，逐个判断下游要不要改…
            </div>
          ) : err ? (
            <div className="py-10 text-center text-[12px] text-zinc-500">连锁分析失败。<button onClick={() => { fetchedFor.current = ""; setCascadeOpen(false); setTimeout(() => setCascadeOpen(true), 0); }} className="text-accent-soft underline">重试</button></div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-zinc-500">下游没有受影响的剧情，无需连锁改写。<div className="mt-1 text-[10px] text-zinc-600">（这次改动的因果范围是收敛的）</div></div>
          ) : (
            <div className="space-y-2.5">
              {actionable.length > 0 && (
                <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                  <span>AI 认为 <b className="text-amber-200">{actionable.length}</b> 处下游需要跟着改</span>
                  <button onClick={acceptAll} className="ml-auto rounded border border-amber-400/40 px-2 py-0.5 text-[10px] text-amber-200 hover:bg-amber-400/10">全部接受</button>
                </div>
              )}
              {actionable.map((r) => {
                const drop = r.action === "drop";
                const accepted = drop ? isAcceptedDrop(r.id) : isAcceptedRewrite(r);
                return (
                  <div key={r.id} className={`rounded-xl border px-3 py-2.5 transition-colors ${accepted ? "border-emerald-400/50 bg-emerald-500/5" : drop ? "border-rose-400/40 bg-rose-500/5" : "border-sky-400/40 bg-sky-500/5"}`}>
                    <div className="flex items-center gap-1.5">
                      {drop ? <Trash2 size={12} className="text-rose-300" /> : <CornerDownRight size={12} className="text-sky-300" />}
                      <span className="text-[11.5px] font-semibold text-zinc-100">{r.title}</span>
                      <span className={`rounded px-1 py-0.5 text-[8px] font-bold ${drop ? "bg-rose-400/20 text-rose-200" : "bg-sky-400/20 text-sky-200"}`}>{drop ? "建议删除" : "建议改写"}</span>
                      <span className="ml-auto text-[8.5px] text-zinc-600">{r.id}</span>
                    </div>
                    <div className="mt-1 text-[10px] leading-relaxed text-zinc-500">因为：{r.reason}</div>
                    {!drop && (
                      <div className="mt-1.5 space-y-1 text-[10.5px] leading-relaxed">
                        <div className="text-zinc-500 line-through decoration-zinc-600">{oldSummary(r.id) || "（原无摘要）"}</div>
                        <div className="flex items-start gap-1 text-sky-100"><ArrowRight size={11} className="mt-0.5 shrink-0 text-sky-400" /><span>{r.newSummary}</span></div>
                        {r.newEffect && <div className="pl-4 text-[9.5px] text-zinc-400">新结果：{r.newEffect}</div>}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      {accepted ? (
                        <button onClick={() => (drop ? draftUndeleteEvent(r.id) : draftClearUpdate(r.id))} className="flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200"><Check size={11} /> 已接受 · 点撤销</button>
                      ) : (
                        <button onClick={() => (drop ? draftDeleteEvent(r.id) : acceptRewrite(r))} className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] text-white ${drop ? "bg-rose-500/80 hover:bg-rose-500" : "bg-sky-500/80 hover:bg-sky-500"}`}>{drop ? <><Trash2 size={11} /> 接受删除</> : <><Check size={11} /> 接受改写</>}</button>
                      )}
                    </div>
                  </div>
                );
              })}
              {keeps.length > 0 && (
                <div className="pt-1">
                  <div className="mb-1 text-[9.5px] text-zinc-600">AI 判断无需改（{keeps.length}）</div>
                  <div className="flex flex-wrap gap-1">
                    {keeps.map((r) => <span key={r.id} className="rounded bg-ink-800 px-1.5 py-0.5 text-[9px] text-zinc-500" title={r.reason}>{r.title}</span>)}
                  </div>
                </div>
              )}
              {capped && <div className="text-center text-[9px] text-amber-300/70">下游过多，本轮只分析了最近 12 处（共 {capped} 处受影响）</div>}
            </div>
          )}
        </div>

        {/* 脚 */}
        <div className="flex items-center gap-2 border-t border-ink-700 px-4 py-2.5">
          <span className="flex items-center gap-1 text-[9.5px] text-zinc-600"><ShieldCheck size={11} className="text-emerald-300" /> 接受后求解器会对整条链重新盖章</span>
          {actionable.length > 0 && <span className="text-[10px] text-zinc-400">已接受 <b className="text-emerald-200">{acceptedCount}</b>/{actionable.length}</span>}
          <button onClick={() => setCascadeOpen(false)} className="ml-auto rounded-lg bg-accent/80 px-3 py-1.5 text-[11px] text-white hover:bg-accent">完成</button>
        </div>
      </div>
    </div>
  );
}
