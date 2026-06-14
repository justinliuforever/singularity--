import { Drama, Eye } from "lucide-react";
import type { Graph, Slice } from "@liumang/shared";
import { useUI } from "../store";

export default function TopBar({ graph, slice }: { graph: Graph; slice: Slice }) {
  const { mode, setMode, act, perspective, enterChar, set } = useUI();
  const acts = graph.meta.acts;
  const curAct = acts.find((a) => a.ord === act);
  const pcs = graph.nodes.filter((n) => n.kind === "character" && n.role === "PC").map((n) => n.id);

  return (
    <header className="flex items-center gap-5 border-b border-ink-700 bg-ink-900/90 px-5 py-2.5 backdrop-blur">
      <div className="flex shrink-0 items-center gap-2">
        <div className="h-6 w-6 rounded bg-gradient-to-br from-accent to-rose-400" />
        <div>
          <div className="text-[13px] font-semibold tracking-tight text-zinc-100">流氓叙事 · 叙事引擎</div>
          <div className="text-[10px] text-zinc-500">一引擎两面 · G(幕, 视角)</div>
        </div>
      </div>

      {/* 模式：现场(玩家·迷雾) / 上帝(创作·全知) */}
      <div className="flex overflow-hidden rounded-lg border border-ink-700">
        <button
          onClick={() => setMode("scene")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] transition-colors ${mode === "scene" ? "bg-rose-400/20 text-rose-200" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          <Drama size={13} /> 现场 · 入局
        </button>
        <button
          onClick={() => setMode("god")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] transition-colors ${mode === "god" ? "bg-accent/25 text-accent-soft" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          <Eye size={13} /> 上帝 · 创作
        </button>
      </div>

      {/* 现场模式：进入谁的视角 */}
      {mode === "scene" && (
        <div className="flex items-center gap-1 overflow-x-auto">
          <Pill active={perspective === "god"} onClick={() => set({ perspective: "god", selFact: null })} tone="god">
            纵览
          </Pill>
          {pcs.map((c) => (
            <Pill key={c} active={perspective === c} onClick={() => enterChar(c)} tone="char">
              {c}
            </Pill>
          ))}
        </div>
      )}

      {/* 右侧度量 */}
      <div className="ml-auto shrink-0 rounded-lg border border-ink-700 bg-ink-850 px-3 py-1 text-center">
        {mode === "god" || perspective === "god" ? (
          <>
            <div className="text-[9px] text-zinc-500">本幕已揭示 / 真相总数</div>
            <div className="text-[13px] font-semibold text-zinc-100">
              {graph.nodes.filter((n) => n.kind === "fact" && n.act != null && n.act <= act).length}
              <span className="text-zinc-500"> / {slice.stats.truthTotal}</span>
            </div>
          </>
        ) : (
          <>
            <div className="text-[9px] text-zinc-500">{perspective} 知道 / 隔离墙后</div>
            <div className="text-[13px] font-semibold">
              <span className="text-know">{slice.stats.knownFacts}</span>
              <span className="text-zinc-600"> / </span>
              <span className="text-rose-300">{slice.stats.hidden}</span>
              {slice.stats.falseBeliefs > 0 && <span className="ml-2 text-[10px] text-truthlie">假信念 {slice.stats.falseBeliefs}</span>}
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function Pill({ active, onClick, children, tone }: { active: boolean; onClick: () => void; children: React.ReactNode; tone: "god" | "char" }) {
  const base = "whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] transition-all border";
  const cls = active
    ? tone === "god"
      ? "bg-zinc-500/20 border-zinc-400 text-zinc-100"
      : "bg-rose-400/15 border-rose-400/70 text-rose-200"
    : "border-ink-700 text-zinc-400 hover:border-ink-600 hover:text-zinc-200";
  return (
    <button onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  );
}
