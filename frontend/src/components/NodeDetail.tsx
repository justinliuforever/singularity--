import { useMemo } from "react";
import { X } from "lucide-react";
import type { Graph, GraphNode } from "@liumang/shared";

export default function NodeDetail({ graph, node, onClose }: { graph: Graph; node: GraphNode; onClose: () => void }) {
  const rel = useMemo(() => {
    const knownBy = graph.edges.filter((e) => e.kind === "KNOWS" && e.target === node.id).map((e) => e.source);
    const falseBy = graph.edges.filter((e) => e.kind === "BELIEVES_FALSELY" && e.target === node.id).map((e) => e.source);
    const revealedBy = graph.edges.filter((e) => e.kind === "REVEALS" && e.target === node.id).map((e) => e.source);
    const reveals = graph.edges.filter((e) => e.kind === "REVEALS" && e.source === node.id).map((e) => e.target);
    return { knownBy, falseBy, revealedBy, reveals };
  }, [graph, node]);

  const isFact = node.kind === "fact";
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-2.5">
        <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-zinc-300">{isFact ? "事实" : node.kind === "clue" ? "线索" : "节点"}</span>
        {node.access === "referee" && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-200">🔒 仅裁判可见</span>}
        {node.act != null && <span className="text-[10px] text-zinc-500">幕序 {node.act}</span>}
        <span className="ml-auto font-mono text-[10px] text-zinc-600">{node.id}</span>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[11px]">
        <div className="text-[13px] font-medium leading-snug text-zinc-100">{node.label}</div>

        {isFact && (node.surface || node.truth) && (
          <div className="space-y-2">
            {node.surface && (
              <div className="rounded-md border border-zinc-600/40 bg-ink-850 px-2.5 py-1.5">
                <div className="mb-0.5 text-[9px] uppercase tracking-wide text-zinc-500">表象（对外口径）</div>
                <div className="leading-relaxed text-zinc-300">{node.surface}</div>
              </div>
            )}
            {node.truth && (
              <div className="rounded-md border border-rose-400/40 bg-rose-500/10 px-2.5 py-1.5">
                <div className="mb-0.5 text-[9px] uppercase tracking-wide text-rose-300">真相（上帝视角）</div>
                <div className="leading-relaxed text-rose-100">{node.truth}</div>
              </div>
            )}
          </div>
        )}

        {node.kind === "clue" && (
          <div className="flex flex-wrap gap-2 text-[10px]">
            {node.clueType && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">{node.clueType}</span>}
            {node.difficulty && <span className="rounded bg-ink-700 px-1.5 py-0.5 text-zinc-300">难度 {node.difficulty}</span>}
          </div>
        )}

        <div className="space-y-1.5 border-t border-ink-700 pt-2">
          <Row label="知道此真相" items={rel.knownBy} tone="text-know" />
          <Row label="误信（假信念）" items={rel.falseBy} tone="text-truthlie" />
          <Row label="被线索揭示" items={rel.revealedBy} tone="text-reveal" />
          <Row label="揭示的事实" items={rel.reveals} tone="text-reveal" />
        </div>
      </div>
    </div>
  );
}

function Row({ label, items, tone }: { label: string; items: string[]; tone: string }) {
  if (!items.length) return null;
  return (
    <div className="text-[10px]">
      <span className="text-zinc-500">{label}：</span>
      <span className={tone}>{[...new Set(items)].join("、")}</span>
    </div>
  );
}
