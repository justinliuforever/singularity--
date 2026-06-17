import { Sparkles, Zap, ShieldCheck, X, RotateCcw, Check, AlertTriangle, CheckCircle2, Loader2, Wand2, Brain } from "lucide-react";
import { useUI, type EditStage } from "../store";
import type { PreviewResult } from "../lib/api";

const STEPS: { key: EditStage; icon: typeof Zap; label: string; color: string }[] = [
  { key: "frame", icon: Sparkles, label: "① 编剧助手", color: "#f59e0b" }, // ① LLM 提议 = InsertPanel 里的「AI 编剧提议」
  { key: "frame", icon: Zap, label: "② 引擎划范围", color: "#a78bfa" },
  { key: "verify", icon: ShieldCheck, label: "③ 求解器盖章", color: "#34d399" },
];
const ORDER: EditStage[] = ["idle", "frame", "verify", "done"];

export default function EditHUD({ affectedCount = 0, cognCount = 0 }: { affectedCount?: number; cognCount?: number }) {
  const { editing, draft, editStage, preview, cascadeOpen, cognitionOpen, clearDraft, commitDraft, setCascadeOpen, setCognitionOpen, setEventMode, set } = useUI();
  if (!editing) return null;
  const dirty = draft.removeEventIds.length + draft.addEvents.length + draft.removeEdges.length + draft.updateEvents.length > 0;
  const stageIdx = ORDER.indexOf(editStage);

  return (
    <div className="absolute bottom-3 left-1/2 z-20 w-[560px] max-w-[90%] -translate-x-1/2 rounded-2xl border border-accent/40 bg-ink-900/95 shadow-2xl backdrop-blur transition-transform duration-200" style={{ transform: cascadeOpen || cognitionOpen ? "translateX(calc(-50% - 192px))" : undefined }}>
      {/* 三段流水线 stepper */}
      <div className="flex items-center gap-1 border-b border-ink-700 px-3 py-2">
        <span className="mr-1 text-[11px] font-semibold text-zinc-200">改本推演</span>
        {STEPS.map((s, i) => {
          const active = ORDER.indexOf(s.key) <= stageIdx && dirty;
          const running = s.key === editStage;
          const Icon = s.icon;
          return (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <span className="h-px w-3" style={{ background: active ? s.color : "#272a37" }} />}
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] transition-all ${running ? "animate-pulse" : ""}`}
                style={{ background: active ? `${s.color}22` : "#15161d", color: active ? s.color : "#52525b", boxShadow: running ? `0 0 0 1px ${s.color}88` : undefined }}
              >
                <Icon size={11} /> {s.label}
              </span>
            </div>
          );
        })}
        <button onClick={() => { clearDraft(); set({ editing: false }); }} className="ml-auto text-zinc-500 hover:text-zinc-200" title="退出改本（丢弃未应用的改动）"><X size={14} /></button>
      </div>

      {/* 主体 */}
      <div className="px-3 py-2.5">
        {dirty && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {draft.addEvents.length > 0 && <Tally color="#34d399" label="＋新增" n={draft.addEvents.length} />}
            {draft.updateEvents.length > 0 && <Tally color="#38bdf8" label="✎改写" n={draft.updateEvents.length} />}
            {draft.removeEventIds.length > 0 && <Tally color="#fb7185" label="✗删除" n={draft.removeEventIds.length} />}
            {affectedCount > 0 && <Tally color="#f59e0b" label="波及" n={affectedCount} />}
            <span className="text-[9px] text-zinc-600">· 画布已铺开全部下游，改动态高亮</span>
          </div>
        )}
        {!dirty ? (
          <div className="text-[11px] text-zinc-500">
            选中一个事件 → <b className="text-rose-300">删除</b>（看下游怎么崩）；或在两节点的边上 <b className="text-accent-soft">＋插入</b> 新剧情。改完引擎自动推演 + 求解器盖章。
          </div>
        ) : editStage !== "done" || !preview ? (
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <Loader2 size={13} className="animate-spin" />
            {editStage === "frame" ? "⚡ 引擎沿因果链推演下游波及范围…" : "🟢 clingo 求解器重验中…"}
          </div>
        ) : (
          <Diff preview={preview} />
        )}
      </div>

      {/* 操作 */}
      {dirty && (
        <div className="flex items-center gap-2 border-t border-ink-700 px-3 py-2">
          <button onClick={clearDraft} className="flex items-center gap-1 rounded-lg border border-ink-700 px-2.5 py-1.5 text-[11px] text-zinc-300 hover:border-rose-400/50 hover:text-rose-200" title="放弃这次改动，回到改本前"><RotateCcw size={12} /> 撤销改动</button>
          {cognCount > 0 && (
            <button onClick={() => setCognitionOpen(!cognitionOpen)} className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${cognitionOpen ? "border-accent/70 bg-accent/20 text-accent-soft" : "border-accent/40 bg-accent/10 text-accent-soft hover:bg-accent/20"}`} title="这次改动牵动了哪些角色的认知（在场/知道/误信/守秘）—— 确定性派生"><Brain size={12} /> 认知影响 · {cognCount}人</button>
          )}
          {affectedCount > 0 && (
            <button onClick={() => { setEventMode("blast"); setCascadeOpen(true); }} className="flex items-center gap-1 rounded-lg border border-amber-400/50 bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-200 hover:bg-amber-400/20" title="先把全部下游铺开，再让 AI 逐个提议怎么跟着改"><Wand2 size={12} /> AI 连锁改写下游 · {affectedCount}</button>
          )}
          <button onClick={commitDraft} className="ml-auto flex items-center gap-1 rounded-lg bg-accent/80 px-3 py-1.5 text-[11px] text-white hover:bg-accent" title="把这次改动应用到画布，本次会话内一直生效（刷新即还原，不写本子）"><Check size={12} /> 应用改动 · 本会话生效</button>
        </div>
      )}
    </div>
  );
}

function Tally({ color, label, n }: { color: string; label: string; n: number }) {
  return <span className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px]" style={{ background: `${color}1e`, color }}><b>{n}</b>{label}</span>;
}

function Diff({ preview }: { preview: PreviewResult }) {
  const { added, cleared } = preview;
  const ok = added.length === 0;
  return (
    <div className="space-y-1.5 text-[11px]">
      <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${ok ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-rose-400/40 bg-rose-500/10 text-rose-200"}`}>
        {ok ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
        <b>求解器盖章：</b>
        {ok ? "改动后结构仍自洽 ✓" : `改动制造了 ${added.length} 个新问题`}
        {cleared.length > 0 && <span className="ml-1 text-emerald-300">· 同时修好 {cleared.length} 个</span>}
      </div>
      {added.map((f, i) => (
        <div key={i} className="rounded border border-rose-400/30 bg-rose-500/5 px-2 py-1 text-[10px] text-rose-100">🔴 新增：{f.title} — {f.detail.slice(0, 56)}{f.bySolver && <span className="ml-1 rounded bg-emerald-500/20 px-1 text-[8px] text-emerald-200">ASP</span>}</div>
      ))}
      {cleared.map((f, i) => (
        <div key={i} className="rounded border border-emerald-400/30 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-100">🟢 修好：{f.title}</div>
      ))}
    </div>
  );
}
