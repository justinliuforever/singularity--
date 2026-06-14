import { useEffect, useMemo, useRef } from "react";
import type { Graph } from "@liumang/shared";
import { useUI } from "../store";

export default function TimelineLens({ graph }: { graph: Graph }) {
  const { act, selFact, hoverFact, set, pickFact } = useUI();
  const curRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    curRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [act]);

  const { acts, byAct } = useMemo(() => {
    const acts = graph.meta.acts.filter((a) => a.ord >= 1);
    const facts = graph.nodes.filter((n) => n.kind === "fact" && n.act != null);
    const clues = graph.nodes.filter((n) => n.kind === "clue" && n.act != null);
    const byAct = new Map<number, { facts: typeof facts; clues: typeof clues }>();
    for (const a of acts) byAct.set(a.ord, { facts: [], clues: [] });
    for (const f of facts) byAct.get(f.act!)?.facts.push(f);
    for (const c of clues) byAct.get(c.act!)?.clues.push(c);
    return { acts, byAct };
  }, [graph]);

  // 只显示有内容的幕
  const liveActs = acts.filter((a) => {
    const b = byAct.get(a.ord)!;
    return b.facts.length || b.clues.length;
  });

  return (
    <div className="h-full overflow-auto p-4">
      <div className="mb-2 flex items-center gap-2 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "#60a5fa" }} />事实揭示</span>
        <span className="flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: "#34d399" }} />线索</span>
        <span className="ml-2 text-zinc-600">当前幕高亮 · 点击 chip 锁定到右栏并跨镜头联动</span>
      </div>
      <div className="flex gap-2">
        {liveActs.map((a) => {
          const b = byAct.get(a.ord)!;
          const cur = a.ord === act;
          return (
            <div key={a.ord} ref={cur ? curRef : null} className={`w-[176px] shrink-0 rounded-lg border p-2 ${cur ? "border-accent/60 bg-accent/5" : "border-ink-700 bg-ink-900/60"}`}>
              <button
                onClick={() => set({ act: a.ord })}
                className={`mb-2 flex w-full items-baseline gap-1.5 text-left transition-colors hover:text-accent-soft ${cur ? "text-accent-soft" : "text-zinc-300"}`}
                title="设为当前幕"
              >
                <span className="text-[12px] font-semibold">{a.name}</span>
                <span className="text-[9px] text-zinc-600">幕{a.ord}</span>
                {cur && <span className="ml-auto rounded bg-accent/25 px-1 text-[8px] text-accent-soft">当前</span>}
              </button>
              <Lane title="事实" color="#60a5fa" items={b.facts} sel={selFact} hov={hoverFact} onPick={pickFact} onHov={(id) => set({ hoverFact: id })} />
              <Lane title="线索" color="#34d399" items={b.clues} sel={selFact} hov={hoverFact} onPick={pickFact} onHov={(id) => set({ hoverFact: id })} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Lane({
  title,
  color,
  items,
  sel,
  hov,
  onPick,
  onHov,
}: {
  title: string;
  color: string;
  items: { id: string; label: string }[];
  sel: string | null;
  hov: string | null;
  onPick: (id: string) => void;
  onHov: (id: string | null) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-2">
      <div className="mb-1 text-[9px] uppercase tracking-wide text-zinc-600">{title} · {items.length}</div>
      <div className="space-y-1">
        {items.map((it) => {
          const on = sel === it.id || hov === it.id;
          return (
            <button
              key={it.id}
              onMouseEnter={() => onHov(it.id)}
              onMouseLeave={() => onHov(null)}
              onClick={() => onPick(it.id)}
              className={`block w-full truncate rounded px-1.5 py-1 text-left text-[10px] leading-tight transition-colors ${on ? "ring-1 ring-accent" : ""}`}
              style={{ background: on ? "rgba(139,92,246,0.18)" : "#15161d", color: "#d4d4d8", borderLeft: `2px solid ${color}` }}
              title={it.label}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
