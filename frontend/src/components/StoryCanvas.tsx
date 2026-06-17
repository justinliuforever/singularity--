import { useMemo } from "react";
import type { StoryGraph, StoryEvent } from "@liumang/shared";
import { useUI } from "../store";

// 布局常量
const LABEL_W = 118;
const HEADER_H = 32;
const COL_W = 208;
const CARD_W = 180;
const CARD_H = 60;
const CARD_GAP = 8;
const LANE_PAD = 12;

// 事件类型 → 颜色（左色条 + 文字色）
const TYPE_COLOR: Record<string, string> = {
  Event: "#60a5fa",
  Decision: "#a78bfa",
  Lie: "#fb7185",
  Reveal: "#34d399",
  RelationChange: "#f59e0b",
  Outcome: "#22d3ee",
  Perception: "#94a3b8",
  Goal: "#c084fc",
};
const TYPE_LABEL: Record<string, string> = {
  Event: "事件", Decision: "决定", Lie: "谎言/欺骗", Reveal: "揭露", RelationChange: "关系变化", Outcome: "结局", Perception: "感知", Goal: "目标",
};
// 因果边类型 → 颜色
const EDGE_COLOR: Record<string, string> = {
  causes: "#94a3b8", motivates: "#a78bfa", enables: "#64748b", reveals: "#34d399", depends_on: "#f59e0b", contradicts: "#fb7185",
};

export default function StoryCanvas({ story, portraitOf, newChars }: { story: StoryGraph; portraitOf: (c: string) => string | null; newChars?: Set<string> }) {
  const { perspective, selEvent, hoverEvent, flagged, pickEvent, openDetail, set } = useUI();
  const layout = useMemo(() => computeLayout(story, newChars), [story, newChars]);
  const isNewChar = (c: string) => !!newChars?.has(c);

  const { lanes, cols, pos, W, H } = layout;
  const evById = new Map(story.events.map((e) => [e.id, e]));
  const focus = perspective !== "god" ? perspective : null;
  const involves = (e: StoryEvent, c: string) => e.actors.some((a) => a.char === c);

  // 高亮：选中/悬停事件 → 其相连边与端点；聚焦角色 → 涉及它的事件
  const active = selEvent ?? hoverEvent;
  const litEdges = new Set<number>();
  story.edges.forEach((ed, i) => {
    if (active && (ed.from === active || ed.to === active)) litEdges.add(i);
  });

  return (
    <div className="relative h-full w-full overflow-auto bg-ink-950">
      <div className="relative" style={{ width: W, height: H }}>
        {/* SVG：泳道底纹 + 幕分隔 + 因果边 */}
        <svg width={W} height={H} className="absolute left-0 top-0" style={{ pointerEvents: "none" }}>
          {/* 泳道底纹 */}
          {lanes.map((ln, i) => {
            const lit = focus === ln.char;
            return <rect key={ln.char} x={0} y={ln.top} width={W} height={ln.height} fill={lit ? "#fb7185" : i % 2 ? "#0f1015" : "#0c0d12"} opacity={lit ? 0.08 : 1} />;
          })}
          {/* 幕分隔竖线 + 顶栏底 */}
          {cols.map((col, j) => (
            <line key={col.key} x1={LABEL_W + j * COL_W} y1={0} x2={LABEL_W + j * COL_W} y2={H} stroke="#1b1d26" strokeWidth={1} />
          ))}
          <line x1={LABEL_W} y1={HEADER_H} x2={W} y2={HEADER_H} stroke="#272a37" strokeWidth={1} />
          <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={H} stroke="#272a37" strokeWidth={1} />

          {/* 因果边 */}
          {story.edges.map((ed, i) => {
            const a = pos.get(ed.from);
            const b = pos.get(ed.to);
            if (!a || !b) return null;
            const sx = a.x + CARD_W, sy = a.y + CARD_H / 2;
            const tx = b.x, ty = b.y + CARD_H / 2;
            const dx = Math.max(40, Math.abs(tx - sx) * 0.4);
            const d = `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`;
            const lit = litEdges.has(i);
            const dim = active && !lit;
            const color = EDGE_COLOR[ed.type] ?? "#475569";
            return (
              <path key={i} d={d} fill="none" stroke={color} strokeWidth={lit ? 2 : 1.1} strokeDasharray={ed.type === "contradicts" ? "4 3" : undefined} opacity={dim ? 0.05 : lit ? 0.95 : 0.22} />
            );
          })}
        </svg>

        {/* 幕表头（点击 → 本幕因果切面） */}
        {cols.map((col, j) => (
          <button
            key={col.key}
            onClick={() => col.ord != null && openDetail("act", col.label)}
            className="absolute flex items-center justify-center text-[11px] font-medium transition-colors hover:text-white"
            style={{ left: LABEL_W + j * COL_W, top: 0, width: COL_W, height: HEADER_H, color: col.ord == null ? "#71717a" : "#a78bfa" }}
            title={col.ord != null ? `${col.label} · 因果切面` : "开局前的背景"}
          >
            {col.label}
          </button>
        ))}

        {/* 泳道标签（角色） */}
        {lanes.map((ln) => {
          const lit = focus === ln.char;
          const portrait = ln.char.startsWith("__") ? null : portraitOf(ln.char);
          return (
            <button
              key={ln.char}
              onClick={() => !ln.char.startsWith("__") && openDetail("char", ln.char)}
              onMouseEnter={() => set({ hoverChar: ln.char })}
              onMouseLeave={() => set({ hoverChar: null })}
              className="absolute flex items-center gap-1.5 border-r border-ink-700 bg-ink-900/95 px-2 text-left transition-colors hover:bg-ink-800"
              style={{ left: 0, top: ln.top, width: LABEL_W, height: ln.height }}
              title={ln.char.startsWith("__") ? ln.char : `${ln.char} · 故事线详图`}
            >
              <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-ink-700 ring-1" style={{ boxShadow: lit ? "0 0 0 2px #fb7185" : isNewChar(ln.char) ? "0 0 0 2px #2dd4bf" : undefined }}>
                {portrait ? <img src={portrait} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-[10px] text-zinc-400">{ln.label.slice(0, 1)}</span>}
              </span>
              <span className="min-w-0">
                <span className={`flex items-center gap-1 truncate text-[11px] ${lit ? "font-semibold text-rose-200" : isNewChar(ln.char) ? "font-medium text-teal-200" : ln.isPC ? "text-zinc-200" : "text-zinc-400"}`}>
                  {ln.label}
                  {isNewChar(ln.char) && <span className="shrink-0 rounded bg-teal-400/20 px-1 text-[8px] font-bold text-teal-200">新</span>}
                </span>
                <span className="block text-[9px] text-zinc-600">{ln.count} 事件</span>
              </span>
            </button>
          );
        })}

        {/* 事件卡片 */}
        {story.events.map((e) => {
          const p = pos.get(e.id);
          if (!p) return null;
          const sel = selEvent === e.id;
          const dimByFocus = focus && !involves(e, focus);
          const color = TYPE_COLOR[e.type] ?? "#60a5fa";
          return (
            <button
              key={e.id}
              onClick={() => pickEvent(e.id)}
              onDoubleClick={() => openDetail("event", e.id)}
              onMouseEnter={() => set({ hoverEvent: e.id })}
              onMouseLeave={() => set({ hoverEvent: null })}
              className={`absolute overflow-hidden rounded-lg border bg-ink-850 text-left transition-shadow ${sel ? "border-accent ring-2 ring-accent/40" : "border-ink-700 hover:border-ink-600"}`}
              style={{ left: p.x, top: p.y, width: CARD_W, height: CARD_H, opacity: dimByFocus ? 0.32 : 1 }}
              title="点击看详情 · 双击展开因果邻域"
            >
              <span className="absolute left-0 top-0 h-full w-1" style={{ background: color }} />
              {flagged[e.id] && (
                <span className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] text-ink-950" style={{ background: flagged[e.id] === "error" ? "#fb7185" : flagged[e.id] === "warn" ? "#f59e0b" : "#38bdf8" }} title="逻辑体检发现问题">!</span>
              )}
              <div className="flex h-full flex-col py-1 pl-2.5 pr-2">
                <div className="line-clamp-2 text-[10.5px] font-medium leading-tight text-zinc-100">{e.title}</div>
                <div className="mt-auto flex items-center gap-1 text-[8px] text-zinc-500">
                  <span className="rounded px-1" style={{ background: `${color}22`, color }}>{TYPE_LABEL[e.type] ?? e.type}</span>
                  {e.actors.slice(0, 3).map((a) => (
                    <span key={a.char} className="truncate">{a.char}</span>
                  ))}
                  {e.facts.length > 0 && <span className="ml-auto text-zinc-600">{e.facts.length}事实</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap items-center gap-2 rounded-lg border border-ink-700 bg-ink-900/90 px-2.5 py-1 text-[9px] text-zinc-500 backdrop-blur">
        <span className="text-zinc-400">事件:</span>
        {(["Event", "Decision", "Lie", "Reveal", "RelationChange"] as const).map((t) => (
          <span key={t} className="flex items-center gap-0.5"><i className="h-2 w-2 rounded-sm" style={{ background: TYPE_COLOR[t] }} />{TYPE_LABEL[t]}</span>
        ))}
        <span className="ml-2 text-zinc-400">因果:</span>
        <span className="flex items-center gap-0.5"><i className="h-0.5 w-3" style={{ background: EDGE_COLOR.causes }} />导致</span>
        <span className="flex items-center gap-0.5"><i className="h-0.5 w-3" style={{ background: EDGE_COLOR.motivates }} />动机</span>
        <span className="flex items-center gap-0.5"><i className="h-0.5 w-3 border-t border-dashed" style={{ borderColor: EDGE_COLOR.contradicts }} />矛盾</span>
      </div>
    </div>
  );
}

interface Lane { char: string; label: string; isPC: boolean; count: number; top: number; height: number }
interface Col { key: string; label: string; ord: number | null }

function computeLayout(story: StoryGraph, newChars?: Set<string>) {
  // 泳道 = PC + 事件数≥5 的关键 NPC + 本会话新增角色（最多 15 条），保证 6 个 PC 都在
  const laneCast = story.cast.filter((c) => !c.char.startsWith("__") && (c.isPC || c.count >= 5 || newChars?.has(c.char))).slice(0, 15);
  const laneChars = laneCast.map((c) => c.char);
  const laneIdx = new Map(laneChars.map((c, i) => [c, i]));

  // 事件归泳道：取它 actors 里在泳道集合中排序最靠前的那个；都不在 → __world__
  const WORLD = "__world__";
  const laneOf = (e: StoryEvent): string => {
    let best: string | null = null, bi = Infinity;
    for (const a of e.actors) {
      const i = laneIdx.get(a.char);
      if (i != null && i < bi) { bi = i; best = a.char; }
    }
    return best ?? WORLD;
  };

  // 列 = 前史 + 有事件的幕（按 ord）
  const ordsPresent = [...new Set(story.events.map((e) => e.actOrd).filter((o): o is number => o != null))].sort((a, b) => a - b);
  const actName = new Map(story.acts.map((a) => [a.ord, a.name]));
  const cols: Col[] = [{ key: "pre", label: "前史·背景", ord: null }, ...ordsPresent.map((o) => ({ key: `a${o}`, label: actName.get(o) ?? `幕${o}`, ord: o }))];
  const colIdx = new Map<number | null, number>();
  cols.forEach((c, j) => colIdx.set(c.ord, j));

  // 分桶 (lane,col)
  const bucket = new Map<string, StoryEvent[]>();
  const key = (lane: string, col: number) => `${lane}|${col}`;
  const hasWorld = story.events.some((e) => laneOf(e) === WORLD);
  for (const e of story.events) {
    const lane = laneOf(e);
    const col = colIdx.get(e.actOrd ?? null) ?? 0;
    const k = key(lane, col);
    (bucket.get(k) ?? bucket.set(k, []).get(k)!).push(e);
  }

  // 泳道顺序 + 动态高度
  const laneOrder = [...laneChars];
  if (hasWorld) laneOrder.push(WORLD);
  const lanes: Lane[] = [];
  let top = HEADER_H;
  for (const ch of laneOrder) {
    let maxStack = 1;
    for (let j = 0; j < cols.length; j++) maxStack = Math.max(maxStack, (bucket.get(key(ch, j)) ?? []).length);
    const height = maxStack * (CARD_H + CARD_GAP) + LANE_PAD;
    const cast = laneCast.find((c) => c.char === ch);
    lanes.push({ char: ch, label: ch === WORLD ? "世界局势 / 群像" : ch, isPC: !!cast?.isPC, count: cast?.count ?? (bucket.size && ch === WORLD ? story.events.filter((e) => laneOf(e) === WORLD).length : 0), top, height });
    top += height;
  }
  const laneTop = new Map(lanes.map((l) => [l.char, l.top]));

  // 卡片定位
  const pos = new Map<string, { x: number; y: number }>();
  for (const [k, evs] of bucket) {
    const [lane, colStr] = k.split("|");
    const col = Number(colStr);
    const x = LABEL_W + col * COL_W + (COL_W - CARD_W) / 2;
    const baseY = (laneTop.get(lane) ?? HEADER_H) + LANE_PAD / 2;
    evs.forEach((e, s) => pos.set(e.id, { x, y: baseY + s * (CARD_H + CARD_GAP) }));
  }

  return { lanes, cols, pos, W: LABEL_W + cols.length * COL_W, H: top };
}
