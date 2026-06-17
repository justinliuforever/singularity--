import { Brain, X, Loader2, MapPin, Lightbulb, AlertTriangle, Lock, ShieldCheck, Users } from "lucide-react";
import { useUI } from "../store";
import type { CognitionResult, CharImpact, CogRel } from "../lib/api";

/**
 * A1 · 改本 → 角色认知·影响面（右栏抽屉）
 * 改一个事件 → 哪些角色的认知被牵动：在场/知道/误信/守秘。纯确定性派生，未调模型。
 * 悬停某角色 → 画布高亮其被牵动的事件。
 */
const REL_META: Record<CogRel, { label: string; color: string; Icon: typeof MapPin }> = {
  actor: { label: "在场", color: "#a78bfa", Icon: MapPin },
  knows: { label: "知道", color: "#34d399", Icon: Lightbulb },
  false: { label: "误信", color: "#f59e0b", Icon: AlertTriangle },
  hide: { label: "守秘", color: "#fb7185", Icon: Lock },
};
const REL_ORDER: CogRel[] = ["hide", "false", "knows", "actor"];

function RelChip({ rel }: { rel: CogRel }) {
  const m = REL_META[rel];
  return (
    <span className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[8.5px] font-semibold" style={{ background: `${m.color}22`, color: m.color }}>
      <m.Icon size={9} /> {m.label}
    </span>
  );
}

function CharCard({ c, soft }: { c: CharImpact; soft?: boolean }) {
  const { hoverChar, set } = useUI();
  const hot = hoverChar === c.char;
  const rels = [...c.rels].sort((a, b) => REL_ORDER.indexOf(a) - REL_ORDER.indexOf(b));
  // 非 actor 的事实（知道/误信/守秘）才是"认知"细节
  const cogFacts = c.facts.filter((f) => f.rel !== "actor").sort((a, b) => REL_ORDER.indexOf(a.rel) - REL_ORDER.indexOf(b.rel));
  return (
    <div
      onMouseEnter={() => set({ hoverChar: c.char, hoverCharEvents: c.events })}
      onMouseLeave={() => set({ hoverChar: null, hoverCharEvents: [] })}
      className={`rounded-xl border px-3 py-2 transition-colors ${hot ? "border-accent/70 bg-accent/10" : soft ? "border-ink-700 bg-ink-850/50" : "border-ink-600 bg-ink-850"}`}
    >
      <div className="flex items-center gap-1.5">
        <b className={`text-[11.5px] ${soft ? "text-zinc-300" : "text-rose-200"}`}>{c.char}</b>
        <div className="flex flex-wrap gap-1">{rels.map((r) => <RelChip key={r} rel={r} />)}</div>
        <span className="ml-auto text-[8.5px] text-zinc-600">{c.events.length} 个事件</span>
      </div>
      {cogFacts.length > 0 && (
        <div className="mt-1.5 space-y-0.5 border-t border-ink-700 pt-1.5">
          {cogFacts.map((f, i) => {
            const m = REL_META[f.rel];
            return (
              <div key={i} className="flex items-start gap-1 text-[10px] leading-relaxed">
                <span className="mt-0.5 shrink-0 font-semibold" style={{ color: m.color }}>{m.label}</span>
                <span className="text-zinc-300">{f.label}</span>
              </div>
            );
          })}
        </div>
      )}
      {cogFacts.length === 0 && c.rels.includes("actor") && (
        <div className="mt-1 text-[9.5px] text-zinc-500">仅作为在场者牵涉（无登记的事实认知）</div>
      )}
    </div>
  );
}

export default function CognitionDrawer({ cog, loading }: { cog: CognitionResult | null; loading: boolean }) {
  const { cognitionOpen, setCognitionOpen } = useUI();
  if (!cognitionOpen) return null;

  const direct = cog?.chars.filter((c) => c.direct) ?? [];
  const soft = cog?.chars.filter((c) => !c.direct) ?? [];

  return (
    <div className="slide-in-right absolute right-0 top-0 bottom-0 z-30 flex w-[372px] max-w-[82%] flex-col border-l border-accent/40 bg-ink-900/97 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
        <Brain size={16} className="text-accent-soft" />
        <div className="text-[12px] font-semibold text-zinc-100">认知影响面</div>
        <span className="text-[10px] text-zinc-500">悬停看牵动哪些事件</span>
        <button onClick={() => setCognitionOpen(false)} className="ml-auto text-zinc-500 hover:text-zinc-200"><X size={15} /></button>
      </div>

      <div className="min-h-[160px] flex-1 overflow-y-auto px-4 py-3">
        {loading && !cog ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[11px] text-accent-soft"><Loader2 size={15} className="animate-spin" /> 沿事件 × 事实派生认知影响…</div>
        ) : !cog || cog.chars.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-zinc-500">这次改动没有牵动到任何角色的已登记认知。<div className="mt-1 text-[10px] text-zinc-600">（被改事件不携带角色知道/误信/守的事实）</div></div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border border-accent/20 bg-accent/5 px-2.5 py-2 text-[10.5px] text-zinc-300">
              <span className="flex items-center gap-1.5"><Users size={12} className="text-accent-soft" /> 这一改牵动 <b className="text-zinc-100">{cog.chars.length}</b> 个角色 · 触动 <b className="text-zinc-100">{cog.factCount}</b> 条事实 · 跨 {cog.touched.length} 个事件</span>
            </div>

            {/* 直接牵动：被改事件本身 */}
            {direct.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" /> 直接牵动（{direct.length}）<span className="text-[8.5px] text-zinc-600">改的就是 ta 在场/知道的事</span>
                </div>
                {direct.map((c) => <CharCard key={c.char} c={c} />)}
              </div>
            )}

            {/* 下游可能波及：沿因果链 */}
            {soft.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" /> 下游可能波及（{soft.length}）<span className="text-[8.5px] text-zinc-600">顺因果链外延，需复核</span>
                </div>
                {soft.map((c) => <CharCard key={c.char} c={c} soft />)}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-ink-700 px-4 py-2.5 text-[9.5px] text-zinc-600">
        <ShieldCheck size={11} className="shrink-0 text-emerald-300" />
        <span>由事件 actors + 携带事实确定性派生（未调模型）。重算每角色 KB、让 agent 认知当场变 = 下一程。</span>
      </div>
    </div>
  );
}
