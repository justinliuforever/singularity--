import { useMemo } from "react";
import type { Graph } from "@liumang/shared";
import { useUI } from "../store";
import { buildMatrix, arrangeCols, truthState, type CellState, type MatrixCol } from "../lib/matrix";

const CW = 16; // 列宽
const RH = 30; // 行高
const HEAD = 30; // 顶部色带
const GUTTER = 126; // 左侧角色名栏宽
const GODGAP = 12;
const GODH = 26;

const FILL: Record<CellState, string> = {
  known: "#60a5fa",
  hide: "#f59e0b",
  false: "#fb7185",
  none: "#191b24",
};
const GLYPH: Record<CellState, string> = { known: "✓", hide: "🔒", false: "✗", none: "" };

/** 列的揭示幕 → 头部色带颜色（越晚揭示越暖） */
function bandColor(revealAct: number | null): string {
  if (revealAct == null) return "#3a3e4f"; // 背景知识
  const map: Record<number, string> = { 1: "#475569", 2: "#3b82f6", 4: "#8b5cf6", 8: "#ec4899" };
  return map[revealAct] ?? "#64748b";
}

export default function MatrixLens({ graph }: { graph: Graph }) {
  const { act, perspective, filter, order, onlyTimed, selFact, hoverFact, hoverChar, set, pickFact, enterChar } = useUI();

  const model = useMemo(() => buildMatrix(graph), [graph]);
  const cols = useMemo(() => arrangeCols(model, { filter, order, onlyTimed }), [model, filter, order, onlyTimed]);

  const rows = model.rows;
  const W = GUTTER + cols.length * CW + 8;
  const gridTop = HEAD;
  const godY = gridTop + rows.length * RH + GODGAP;
  const H = godY + GODH + 8;

  // 当前幕前沿：第一个 revealAct > act 的列索引（仅 order==='act' 有意义）
  const frontier = order === "act" ? cols.findIndex((c) => (c.revealAct ?? -1) > act) : -1;

  const active = selFact ?? hoverFact;
  const activeIdx = active ? cols.findIndex((c) => c.id === active) : -1;
  const focusRow = perspective !== "god" ? perspective : null;

  // 列是否"已到揭示幕"
  const colLive = (c: MatrixCol) => (c.revealAct == null ? true : c.revealAct <= act);

  return (
    <div className="flex h-full flex-col">
      <ReadBar cols={cols} activeId={active} model={model} act={act} />
      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <svg width={W} height={H} className="block">
          {/* 选中列竖直高亮带 */}
          {activeIdx >= 0 && (
            <rect x={GUTTER + activeIdx * CW} y={0} width={CW} height={godY + GODH} fill="#8b5cf6" opacity={0.12} />
          )}
          {/* 幕前沿分隔线 */}
          {frontier > 0 && (
            <line
              x1={GUTTER + frontier * CW}
              y1={4}
              x2={GUTTER + frontier * CW}
              y2={godY + GODH}
              stroke="#8b5cf6"
              strokeDasharray="3 3"
              strokeWidth={1}
              opacity={0.6}
            />
          )}

          {/* 顶部色带（按揭示幕） */}
          {cols.map((c, i) => {
            const live = colLive(c);
            return (
              <g key={`h-${c.id}`} onMouseEnter={() => set({ hoverFact: c.id })} onMouseLeave={() => set({ hoverFact: null })} onClick={() => pickFact(c.id)} className="cursor-pointer">
                <rect x={GUTTER + i * CW} y={6} width={CW - 2} height={HEAD - 12} rx={2} fill={bandColor(c.revealAct)} opacity={live ? (c.hasFalse ? 0.95 : 0.6) : 0.18} />
                {c.hasFalse && <rect x={GUTTER + i * CW} y={2} width={CW - 2} height={3} rx={1.5} fill="#fb7185" />}
              </g>
            );
          })}

          {/* 行 */}
          {rows.map((r, ri) => {
            const y = gridTop + ri * RH;
            const dim = focusRow != null && focusRow !== r.id;
            return (
              <g key={r.id} opacity={dim ? 0.32 : 1}>
                {focusRow === r.id && <rect x={0} y={y} width={W} height={RH} fill="#fb7185" opacity={0.08} />}
                {focusRow !== r.id && hoverChar === r.id && <rect x={GUTTER} y={y} width={W - GUTTER} height={RH} fill="#8b5cf6" opacity={0.08} />}
                {cols.map((c, ci) => {
                  const cell = model.cell[r.id][c.id];
                  const learned = cell && (cell.edgeAct == null || cell.edgeAct <= act);
                  const live = colLive(c);
                  let state: CellState = "none";
                  let faint = false;
                  if (cell) {
                    if (learned && live) state = cell.state;
                    else faint = true; // 在场但本幕尚未获得 → 虚线占位
                  }
                  const x = GUTTER + ci * CW;
                  return (
                    <g
                      key={c.id}
                      className="cursor-pointer"
                      onMouseEnter={() => set({ hoverFact: c.id, hoverChar: r.id })}
                      onMouseLeave={() => set({ hoverFact: null, hoverChar: null })}
                      onClick={() => pickFact(c.id)}
                    >
                      <rect
                        x={x + 1}
                        y={y + 3}
                        width={CW - 3}
                        height={RH - 6}
                        rx={3}
                        fill={state === "none" ? FILL.none : FILL[state]}
                        opacity={state === "none" ? (faint ? 0.0 : 1) : 1}
                        stroke={faint ? "#3a3e4f" : "none"}
                        strokeDasharray={faint ? "2 2" : undefined}
                        strokeWidth={faint ? 1 : 0}
                      />
                      {state !== "none" && (
                        <text x={x + CW / 2 - 0.5} y={y + RH / 2} textAnchor="middle" dominantBaseline="central" fontSize={state === "hide" ? 9 : 11} fill="#0a0a0f" fontWeight={700}>
                          {GLYPH[state]}
                        </text>
                      )}
                      {state === "false" && <rect x={x + 1} y={y + 3} width={CW - 3} height={RH - 6} rx={3} fill="none" stroke="#fb7185" strokeWidth={1.4} className="lie-pulse" />}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* 角色名栏（左侧固定列，画在 SVG 左侧） */}
          <defs>
            {rows.map((r, ri) => {
              const y = gridTop + ri * RH;
              return <clipPath key={`clip-${r.id}`} id={`av-${ri}`}><circle cx={18} cy={y + RH / 2} r={9} /></clipPath>;
            })}
          </defs>
          <rect x={0} y={0} width={GUTTER - 2} height={H} fill="#0f1015" />
          {rows.map((r, ri) => {
            const y = gridTop + ri * RH;
            const focused = focusRow === r.id;
            const ring = focused ? "#fb7185" : hoverChar === r.id ? "#8b5cf6" : "#3a3e4f";
            return (
              <g key={`lbl-${r.id}`} className="cursor-pointer" onClick={() => enterChar(r.id)} onMouseEnter={() => set({ hoverChar: r.id })} onMouseLeave={() => set({ hoverChar: null })}>
                <circle cx={18} cy={y + RH / 2} r={10} fill="#15161d" stroke={ring} strokeWidth={1.5} />
                {r.image ? (
                  <image href={r.image} x={9} y={y + RH / 2 - 9} width={18} height={18} clipPath={`url(#av-${ri})`} preserveAspectRatio="xMidYMid slice" />
                ) : (
                  <text x={18} y={y + RH / 2} textAnchor="middle" dominantBaseline="central" fontSize={10} fill="#a1a1aa">{r.label.slice(0, 1)}</text>
                )}
                <text x={34} y={y + RH / 2} dominantBaseline="central" fontSize={12} fill={focused ? "#fb7185" : "#d4d4d8"} fontWeight={focused ? 700 : 500}>
                  {r.label}
                </text>
                <text x={GUTTER - 8} y={y + RH / 2} textAnchor="end" dominantBaseline="central" fontSize={9} fill="#52525b">
                  {r.total}
                </text>
              </g>
            );
          })}
          <text x={10} y={HEAD / 2} dominantBaseline="central" fontSize={9} fill="#52525b">
            角色 \ 事实
          </text>

          {/* 上帝行：客观·已揭示 */}
          <rect x={0} y={godY - 4} width={W} height={GODH + 6} fill="#0d0e13" />
          <line x1={GUTTER} y1={godY - 4} x2={W} y2={godY - 4} stroke="#272a37" strokeWidth={1} />
          <text x={10} y={godY + GODH / 2} dominantBaseline="central" fontSize={10} fill="#34d399" fontWeight={600}>
            客观真相
          </text>
          {cols.map((c, ci) => {
            const ts = truthState(c, act);
            const x = GUTTER + ci * CW;
            const col = ts === "revealed" ? "#34d399" : ts === "secret" ? "#f59e0b" : "#272a37";
            const g = ts === "revealed" ? "✓" : ts === "secret" ? "🔒" : "·";
            return (
              <g key={`god-${c.id}`}>
                <rect x={x + 1} y={godY} width={CW - 3} height={GODH - 4} rx={3} fill={col} opacity={ts === "hidden" ? 0.3 : 1} />
                {ts !== "hidden" && (
                  <text x={x + CW / 2 - 0.5} y={godY + (GODH - 4) / 2} textAnchor="middle" dominantBaseline="central" fontSize={ts === "secret" ? 8 : 10} fill="#0a0a0f" fontWeight={700}>
                    {g}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <Legend n={cols.length} />
    </div>
  );
}

function ReadBar({ cols, activeId, model, act }: { cols: MatrixCol[]; activeId: string | null; model: ReturnType<typeof buildMatrix>; act: number }) {
  const c = activeId ? cols.find((x) => x.id === activeId) : null;
  if (!c) {
    return (
      <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-2 text-[11px] text-zinc-500">
        <span className="font-mono text-zinc-600">{cols.length} 列在场事实</span>
        <span className="text-zinc-600">·</span>
        <span>悬停色带看事实，点击锁定到右栏</span>
      </div>
    );
  }
  const holders = model.rows.filter((r) => model.cell[r.id][c.id]);
  return (
    <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-2 text-[11px]">
      <span className="font-mono text-zinc-600">{c.id}</span>
      {c.revealAct != null && <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[9px] text-zinc-400">幕{c.revealAct}揭示</span>}
      {c.hasFalse && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[9px] text-rose-200">含误信</span>}
      <span className="truncate text-zinc-300">{c.label}</span>
      <span className="ml-auto shrink-0 text-[10px] text-zinc-500">{holders.length} 人持有</span>
    </div>
  );
}

function Legend({ n }: { n: number }) {
  const items: [string, string, string][] = [
    ["#60a5fa", "✓", "已知"],
    ["#f59e0b", "🔒", "持有的秘密"],
    ["#fb7185", "✗", "误信（反转点）"],
    ["#34d399", "✓", "客观已揭示"],
  ];
  return (
    <div className="flex items-center gap-3 border-t border-ink-700 px-4 py-2 text-[10px] text-zinc-500">
      {items.map(([c, g, t]) => (
        <span key={t} className="flex items-center gap-1">
          <span className="grid h-3.5 w-3.5 place-items-center rounded text-[8px] text-ink-950" style={{ background: c }}>
            {g}
          </span>
          {t}
        </span>
      ))}
      <span className="ml-auto text-zinc-600">虚线格=在场但本幕未获知 · 竖虚线=本幕揭示前沿</span>
    </div>
  );
}
