import { useMemo } from "react";
import type { Graph } from "@liumang/shared";

/** 真相解锁 / 张力曲线：每幕"可被揭示的真相占比"（创作侧揭示节奏） */
export default function TensionCurve({ graph, act }: { graph: Graph; act: number }) {
  const { pts, total, refOnly } = useMemo(() => {
    const facts = graph.nodes.filter((n) => n.kind === "fact");
    const total = facts.length;
    const refOnly = facts.filter((f) => f.act == null).length;
    const acts = graph.meta.acts;
    const pts = acts.map((a) => {
      const revealed = facts.filter((f) => f.act != null && f.act <= a.ord).length;
      return { ord: a.ord, name: a.name, pct: total ? revealed / total : 0 };
    });
    return { pts, total, refOnly };
  }, [graph]);

  const W = 320,
    H = 96,
    pad = 6;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const y = (p: number) => H - pad - p * (H - 2 * pad);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.pct)}`).join(" ");
  const area = `${path} L${x(pts.length - 1)},${H - pad} L${x(0)},${H - pad} Z`;
  const curIdx = Math.max(0, pts.findIndex((p) => p.ord === act));

  return (
    <div className="px-4 py-3">
      <div className="mb-1 text-[11px] font-medium text-zinc-300">真相解锁曲线（创作侧）</div>
      <div className="mb-2 text-[10px] text-zinc-500">
        共 {total} 条真相 · 其中 <span className="text-amber-300">{refOnly}</span> 条仅靠分幕/演绎逼出（线索不直发）
      </div>
      <svg width={W} height={H} className="overflow-visible">
        <defs>
          <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#tg)" />
        <path d={path} fill="none" stroke="#a78bfa" strokeWidth="1.6" />
        {curIdx >= 0 && (
          <>
            <line x1={x(curIdx)} y1={pad} x2={x(curIdx)} y2={H - pad} stroke="#fb7185" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(curIdx)} cy={y(pts[curIdx].pct)} r="3" fill="#fb7185" />
          </>
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[8px] text-zinc-600">
        <span>{pts[0]?.name}</span>
        <span className="text-rose-300">{pts[curIdx]?.name} · {Math.round((pts[curIdx]?.pct ?? 0) * 100)}%</span>
        <span>{pts[pts.length - 1]?.name}</span>
      </div>
    </div>
  );
}
