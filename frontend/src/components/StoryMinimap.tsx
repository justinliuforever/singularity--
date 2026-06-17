import { useMemo, useState } from "react";
import { Map as MapIcon, ChevronDown, Home } from "lucide-react";
import type { StoryGraph, StoryEvent } from "@liumang/shared";
import { useUI } from "../store";

const LABEL_W = 62;
const CELL_W = 22;
const CELL_H = 17;
const HEAD = 16;

const SHORT: Record<string, string> = { 序幕: "序", 第一幕: "1", 第二幕: "2", 第三幕: "3", 第四幕: "4", 第五幕: "5", 第六幕: "6", 第七幕: "7", 无声之旅: "无声", 无所容心: "无容", 第十幕: "10", 结局演绎剧场: "结局" };

/** 故事全景图 ·「你在这里」——角色×幕 在场格子，高亮当前详图覆盖的范围（不是散点，看得清） */
export default function StoryMinimap({ story, highlight, caption, portraitOf }: { story: StoryGraph; highlight: Set<string>; caption: string; portraitOf: (c: string) => string | null }) {
  const { closeDetail } = useUI();
  const [open, setOpen] = useState(true);

  const { lanes, cols, cells } = useMemo(() => {
    const laneChars = story.cast.filter((c) => !c.char.startsWith("__") && (c.isPC || c.count >= 5)).slice(0, 14).map((c) => c.char);
    const laneIdx = new Map(laneChars.map((c, i) => [c, i]));
    const ords = [...new Set(story.events.map((e) => e.actOrd).filter((o): o is number => o != null))].sort((a, b) => a - b);
    const ordName = new Map(story.acts.map((a) => [a.ord, a.name]));
    const cols = [{ ord: null as number | null, label: "前史" }, ...ords.map((o) => ({ ord: o, label: SHORT[ordName.get(o) ?? ""] ?? String(o) }))];
    const colIdx = new Map<number | null, number>(cols.map((c, j) => [c.ord, j]));
    const laneOf = (e: StoryEvent) => {
      let bi = Infinity, best = -1;
      for (const a of e.actors) { const i = laneIdx.get(a.char); if (i != null && i < bi) { bi = i; best = i; } }
      return best;
    };
    // cell[lane][col] = { total, lit }
    const cells = new Map<string, { total: number; lit: number }>();
    for (const e of story.events) {
      const lane = laneOf(e);
      if (lane < 0) continue;
      const col = colIdx.get(e.actOrd ?? null) ?? 0;
      const k = `${lane}|${col}`;
      const cur = cells.get(k) ?? { total: 0, lit: 0 };
      cur.total++;
      if (highlight.has(e.id)) cur.lit++;
      cells.set(k, cur);
    }
    return { lanes: laneChars, cols, cells };
  }, [story, highlight]);

  const gridW = LABEL_W + cols.length * CELL_W;

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-900/95 px-2.5 py-1.5 text-[10px] text-zinc-300 shadow-xl backdrop-blur hover:border-accent/60">
        <MapIcon size={13} className="text-accent-soft" /> 你在这里
      </button>
    );

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/95 p-2 shadow-2xl backdrop-blur" style={{ width: gridW + 16 }}>
      <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
        <MapIcon size={12} className="text-accent-soft" />
        <span className="text-[10px] font-medium text-zinc-300">你在这里</span>
        <button onClick={closeDetail} className="ml-auto flex items-center gap-0.5 text-[9px] text-zinc-500 hover:text-zinc-200" title="回总览"><Home size={10} />总览</button>
        <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-200"><ChevronDown size={13} /></button>
      </div>
      <div className="mb-1.5 truncate rounded bg-accent/10 px-1.5 py-1 text-[10px] text-accent-soft">{caption}</div>
      <svg width={gridW} height={HEAD + lanes.length * CELL_H} className="block">
        {cols.map((c, j) => (
          <text key={j} x={LABEL_W + j * CELL_W + CELL_W / 2} y={HEAD / 2} textAnchor="middle" dominantBaseline="central" fontSize={8} fill={c.ord == null ? "#52525b" : "#71717a"}>{c.label}</text>
        ))}
        {lanes.map((ch, i) => {
          const y = HEAD + i * CELL_H;
          const laneLit = cols.some((_, j) => (cells.get(`${i}|${j}`)?.lit ?? 0) > 0);
          return (
            <g key={ch}>
              {/* 该泳道若被聚焦，整行底纹 */}
              {laneLit && <rect x={LABEL_W} y={y} width={cols.length * CELL_W} height={CELL_H} fill="#8b5cf6" opacity={0.07} />}
              <clipPath id={`mm-${i}`}><circle cx={9} cy={y + CELL_H / 2} r={6} /></clipPath>
              {portraitOf(ch) ? (
                <image href={portraitOf(ch)!} x={3} y={y + CELL_H / 2 - 6} width={12} height={12} clipPath={`url(#mm-${i})`} preserveAspectRatio="xMidYMid slice" />
              ) : (
                <circle cx={9} cy={y + CELL_H / 2} r={6} fill="#272a37" />
              )}
              <text x={19} y={y + CELL_H / 2} dominantBaseline="central" fontSize={8.5} fill={laneLit ? "#ddd6fe" : "#71717a"}>{ch.slice(0, 4)}</text>
              {cols.map((_, j) => {
                const c = cells.get(`${i}|${j}`);
                if (!c || c.total === 0) return null;
                const lit = c.lit > 0;
                const x = LABEL_W + j * CELL_W;
                return (
                  <rect
                    key={j}
                    x={x + 2}
                    y={y + 2}
                    width={CELL_W - 4}
                    height={CELL_H - 4}
                    rx={2.5}
                    fill={lit ? "#a78bfa" : "#3a3e4f"}
                    opacity={lit ? 1 : Math.min(0.5, 0.2 + c.total * 0.1)}
                  >
                    {lit && <animate attributeName="opacity" values="1;0.6;1" dur="1.8s" repeatCount="indefinite" />}
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center gap-2 px-0.5 text-[8.5px] text-zinc-600">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#a78bfa]" />当前焦点</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#3a3e4f]" />其它事件</span>
      </div>
    </div>
  );
}
