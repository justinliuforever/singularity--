import { X, Stethoscope, AlertTriangle, AlertOctagon, Info, ArrowRight, CheckCircle2 } from "lucide-react";
import { useUI } from "../store";
import type { Severity } from "../lib/api";

const SEV: Record<Severity, { color: string; bg: string; icon: typeof Info; label: string }> = {
  error: { color: "#fb7185", bg: "bg-rose-500/10 border-rose-400/40", icon: AlertOctagon, label: "错误" },
  warn: { color: "#f59e0b", bg: "bg-amber-400/10 border-amber-400/40", icon: AlertTriangle, label: "警告" },
  info: { color: "#38bdf8", bg: "bg-sky-500/10 border-sky-400/40", icon: Info, label: "提示" },
};

export default function AuditPanel({ onClose }: { onClose: () => void }) {
  const { audit, openDetail } = useUI();
  if (!audit) return null;
  const { findings, stats } = audit;

  const jump = (eventId: string) => { openDetail("event", eventId, "explore"); onClose(); };

  return (
    <div className="absolute inset-0 z-30 flex justify-start bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-[440px] max-w-[85%] flex-col border-r border-ink-700 bg-ink-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
          <Stethoscope size={16} className="text-emerald-300" />
          <div className="text-[13px] font-semibold text-zinc-100">创作逻辑体检</div>
          <span className="text-[10px] text-zinc-500">确定性图检查 · 不靠 LLM</span>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-200"><X size={15} /></button>
        </div>

        {/* 统计 */}
        <div className="grid grid-cols-3 gap-2 border-b border-ink-700 px-4 py-3 text-center">
          <Stat label="事件 / 因果" v={`${stats.events}/${stats.edges}`} tone="text-zinc-200" />
          <Stat label="矛盾" v={stats.contradictions} tone={stats.contradictions ? "text-amber-300" : "text-zinc-500"} />
          <Stat label="因果环" v={stats.cycles} tone={stats.cycles ? "text-rose-300" : "text-emerald-300"} />
          <Stat label="结局缺前因" v={stats.unmotivated} tone={stats.unmotivated ? "text-amber-300" : "text-zinc-500"} />
          <Stat label="时序悖论" v={stats.temporal ?? 0} tone={stats.temporal ? "text-rose-300" : "text-emerald-300"} />
          <Stat label="谜底不可达" v={stats.unsolvable ?? 0} tone={stats.unsolvable ? "text-amber-300" : "text-emerald-300"} />
        </div>

        {/* ASP 求解器确认 */}
        {audit.solver && (
          <div className="flex items-center gap-1.5 border-b border-ink-700 bg-emerald-500/5 px-4 py-1.5 text-[10px] text-emerald-200/90">
            <span className="rounded bg-emerald-500/20 px-1 text-[8px] text-emerald-200">ASP</span>
            {audit.solver} 求解器确认：时序{stats.temporal ? `${stats.temporal} 处悖论` : " ✓ 无悖论"} · 可解性{stats.unsolvable ? `${stats.unsolvable} 处不可达` : " ✓ 谜底全可达"}（求解器盖章，非 LLM）
          </div>
        )}

        {/* 发现列表 */}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {findings.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-3 text-[12px] text-emerald-200">
              <CheckCircle2 size={16} /> 未发现矛盾 / 因果环 / 悬空结局——结构自洽 ✓
            </div>
          ) : (
            findings.map((f) => {
              const s = SEV[f.severity];
              const Icon = s.icon;
              return (
                <div key={f.id} className={`rounded-lg border px-3 py-2 ${s.bg}`}>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Icon size={13} style={{ color: s.color }} />
                    <span className="font-medium text-zinc-100">{f.title}</span>
                    <span className="rounded px-1 text-[8px]" style={{ background: `${s.color}22`, color: s.color }}>{s.label}</span>
                    {f.bySolver && <span className="rounded bg-emerald-500/20 px-1 text-[8px] text-emerald-200" title="由 ASP 求解器确认">ASP</span>}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-zinc-400">{f.detail}</div>
                  <button onClick={() => jump(f.events[0])} className="mt-1.5 flex items-center gap-1 text-[10px] text-accent-soft hover:text-white">
                    定位到事件图 <ArrowRight size={11} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-ink-700 px-4 py-2 text-[9.5px] leading-relaxed text-zinc-600">
          图层（矛盾/因果环/缺前因）+ <b className="text-emerald-300/80">ASP 求解器</b>（时序一致性/可解性可达）双层确认，皆外部锚定、不靠 LLM。* 无前因/无后果仅统计参考。<b className="text-zinc-500">孤儿知识</b>精确版 + <b className="text-zinc-500">凶手唯一可推</b>待信念 schema 提供推断模型后接入。
        </div>
      </div>
    </div>
  );
}

function Stat({ label, v, tone }: { label: string; v: string | number; tone: string }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-850 py-1.5">
      <div className={`text-[14px] font-semibold ${tone}`}>{v}</div>
      <div className="text-[8.5px] text-zinc-500">{label}</div>
    </div>
  );
}
