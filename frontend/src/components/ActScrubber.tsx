import { useMemo } from "react";
import type { Graph } from "@liumang/shared";
import { useUI } from "../store";

/**
 * 底部「幕」时间轴（仅现场·入局）——战争迷雾时间机器。
 * 点哪一幕，认知卡/迷雾就更新到哪一幕。每幕显示"发牌密度"：本幕新揭示的事实(蓝) + 新发的线索(绿)。
 * 幕名从图谱 meta.acts 派生（不写死单本，换本不崩）。
 */
export default function ActScrubber({ graph }: { graph: Graph }) {
  const { act, set } = useUI();

  const acts = useMemo(() => {
    const facts = graph.nodes.filter((n) => n.kind === "fact" && n.act != null);
    const clues = graph.nodes.filter((n) => n.kind === "clue" && n.act != null);
    const rows = graph.meta.acts.map((a) => ({
      ord: a.ord,
      name: a.name,
      facts: facts.filter((f) => f.act === a.ord).length,
      clues: clues.filter((c) => c.act === a.ord).length,
    }));
    // 去掉完全没内容的"开本前准备"这类
    return rows.filter((r) => r.ord >= 1 || r.facts || r.clues);
  }, [graph]);

  const maxN = Math.max(1, ...acts.map((a) => a.facts + a.clues));

  return (
    <div className="flex shrink-0 items-stretch gap-px border-t border-ink-700 bg-ink-950 px-3 py-1.5">
      <div className="flex w-16 shrink-0 flex-col justify-center pr-2 text-right">
        <div className="text-[9px] text-zinc-600">时间轴</div>
        <div className="text-[10px] font-medium text-accent-soft">幕 Z</div>
      </div>
      <div className="flex flex-1 items-end gap-px">
        {acts.map((a) => {
          const cur = a.ord === act;
          const total = a.facts + a.clues;
          return (
            <button
              key={a.ord}
              onClick={() => set({ act: a.ord })}
              title={`${a.name}：揭示事实 ${a.facts} · 发放线索 ${a.clues}`}
              className={`group flex min-w-0 flex-1 flex-col items-center justify-end rounded-md px-0.5 pb-1 pt-1.5 transition-colors ${
                cur ? "bg-accent/20 ring-1 ring-accent/60" : "hover:bg-ink-800"
              }`}
            >
              {/* 密度条：事实蓝 / 线索绿 */}
              <div className="flex h-[28px] items-end gap-[1px]" style={{ opacity: total ? 1 : 0.25 }}>
                <div className="w-[5px] rounded-sm bg-know" style={{ height: Math.max(total ? 2 : 0, 28 * (a.facts / maxN)) }} />
                <div className="w-[5px] rounded-sm bg-reveal" style={{ height: Math.max(total ? 2 : 0, 28 * (a.clues / maxN)) }} />
              </div>
              <div className={`mt-1 max-w-full truncate text-[9px] leading-tight ${cur ? "font-semibold text-accent-soft" : "text-zinc-500 group-hover:text-zinc-300"}`}>
                {a.name}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-3 pl-3 text-[9px] text-zinc-600">
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-know" />揭示事实</span>
        <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-reveal" />发放线索</span>
      </div>
    </div>
  );
}
