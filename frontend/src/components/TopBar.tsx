import type { Graph, Slice } from "@liumang/shared";

export default function TopBar({
  graph,
  act,
  setAct,
  perspective,
  setPerspective,
  slice,
}: {
  graph: Graph;
  act: number;
  setAct: (n: number) => void;
  perspective: string;
  setPerspective: (p: string) => void;
  slice: Slice;
}) {
  const acts = graph.meta.acts;
  const minOrd = acts[0]?.ord ?? 0;
  const maxOrd = acts[acts.length - 1]?.ord ?? 12;
  const curAct = acts.find((a) => a.ord === act) ?? acts.reduce((p, c) => (c.ord <= act ? c : p), acts[0]);
  const pcs = graph.nodes.filter((n) => n.kind === "character" && n.role === "PC").map((n) => n.id);

  return (
    <header className="flex items-center gap-5 border-b border-ink-700 bg-ink-900/90 px-5 py-2.5 backdrop-blur">
      <div className="flex items-center gap-2 shrink-0">
        <div className="h-6 w-6 rounded bg-gradient-to-br from-accent to-rose-400" />
        <div>
          <div className="text-[13px] font-semibold tracking-tight text-zinc-100">流氓叙事 · 叙事图谱引擎</div>
          <div className="text-[10px] text-zinc-500">G(幕, 视角) — 时序 · 多视角知识图谱</div>
        </div>
      </div>

      {/* 视角 */}
      <div className="flex items-center gap-1 overflow-x-auto">
        <span className="mr-1 text-[10px] text-zinc-500">视角</span>
        <Pill active={perspective === "god"} onClick={() => setPerspective("god")} tone="god">
          上帝视角
        </Pill>
        {pcs.map((c) => (
          <Pill key={c} active={perspective === c} onClick={() => setPerspective(c)} tone="char">
            {c}
          </Pill>
        ))}
      </div>

      {/* 幕滑块 Z */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        <span className="text-[10px] text-zinc-500">幕(Z)</span>
        <input
          type="range"
          min={minOrd}
          max={maxOrd}
          step={1}
          value={act}
          onChange={(e) => setAct(Number(e.target.value))}
          className="h-1 w-56 cursor-pointer appearance-none rounded-full bg-ink-600 accent-accent"
        />
        <span className="w-28 text-[12px] font-medium text-accent-soft">{curAct?.name ?? `第${act}幕`}</span>
      </div>

      {/* 隔离墙度量 */}
      <div className="shrink-0 rounded-lg border border-ink-700 bg-ink-850 px-3 py-1 text-center">
        {perspective === "god" ? (
          <>
            <div className="text-[9px] text-zinc-500">已揭示 / 真相总数</div>
            <div className="text-[13px] font-semibold text-zinc-100">
              {acts.length ? graph.nodes.filter((n) => n.kind === "fact" && n.act != null && n.act <= act).length : 0}
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
      ? "bg-accent/20 border-accent text-accent-soft"
      : "bg-rose-400/15 border-rose-400/70 text-rose-200"
    : "border-ink-700 text-zinc-400 hover:border-ink-600 hover:text-zinc-200";
  return (
    <button onClick={onClick} className={`${base} ${cls}`}>
      {children}
    </button>
  );
}
