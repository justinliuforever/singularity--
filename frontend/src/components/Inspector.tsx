import { useMemo } from "react";
import type { Graph, GraphNode } from "@liumang/shared";

const kindLabel: Record<string, string> = { character: "人物", fact: "事实", clue: "线索", event: "事件" };

export default function Inspector({ graph, node }: { graph: Graph; node: GraphNode | null }) {
  const rel = useMemo(() => {
    if (!node) return null;
    if (node.kind === "fact") {
      const knownBy = graph.edges.filter((e) => e.kind === "KNOWS" && e.target === node.id).map((e) => e.source);
      const falseBy = graph.edges.filter((e) => e.kind === "BELIEVES_FALSELY" && e.target === node.id).map((e) => e.source);
      const revealedBy = graph.edges.filter((e) => e.kind === "REVEALS" && e.target === node.id).map((e) => e.source);
      return { knownBy, falseBy, revealedBy };
    }
    if (node.kind === "character") {
      const knows = graph.edges.filter((e) => e.kind === "KNOWS" && e.source === node.id).length;
      const fb = graph.edges.filter((e) => e.kind === "BELIEVES_FALSELY" && e.source === node.id);
      const rels = graph.edges.filter((e) => e.kind === "REL" && e.source === node.id);
      return { knows, fb, rels };
    }
    return null;
  }, [graph, node]);

  if (!node)
    return (
      <div className="px-4 py-6 text-center text-[11px] text-zinc-600">
        点击任意节点查看详情
        <div className="mt-3 space-y-1 text-left text-[10px] text-zinc-500">
          <Legend color="#8b5cf6" label="人物（PC 紫环 / NPC 灰环）" />
          <Legend color="#3b82f6" label="KNOWS 角色知道的事实" />
          <Legend color="#fb7185" label="BELIEVES_FALSELY 假信念（反转点）" />
          <Legend color="#f59e0b" label="🔒 仅裁判可见的真相（隔离墙）" />
          <Legend color="#34d399" label="REVEALS 线索→事实" />
        </div>
      </div>
    );

  return (
    <div className="space-y-3 px-4 py-3 text-[12px]">
      <div className="flex items-center gap-2">
        <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-zinc-300">{kindLabel[node.kind]}</span>
        {node.access === "referee" && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-200">🔒 仅裁判</span>}
        {node.role && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-200">{node.role}</span>}
        {node.act != null && <span className="text-[10px] text-zinc-500">幕序 {node.act}</span>}
      </div>
      <div className="font-medium leading-snug text-zinc-100">{node.label}</div>
      {node.aliases && node.aliases.length > 0 && (
        <div className="text-[10px] text-zinc-500">别名：{node.aliases.join(" / ")}</div>
      )}

      {node.kind === "fact" && rel && "knownBy" in rel && (
        <div className="space-y-1.5 border-t border-ink-700 pt-2">
          <Row label="知道此真相" items={rel.knownBy} tone="know" />
          <Row label="误信(假信念)" items={rel.falseBy} tone="lie" />
          <Row label="被线索揭示" items={rel.revealedBy} tone="reveal" />
        </div>
      )}
      {node.kind === "character" && rel && "knows" in rel && (
        <div className="space-y-1.5 border-t border-ink-700 pt-2 text-[11px]">
          <div>
            掌握真相 <span className="text-know">{rel.knows}</span> 条
            {rel.fb.length > 0 && <span className="ml-2 text-truthlie">假信念 {rel.fb.length} 条</span>}
          </div>
          {rel.fb.length > 0 && (
            <div className="rounded bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200">
              ★ 误信：{rel.fb.map((e) => graph.nodes.find((n) => n.id === e.target)?.label.slice(0, 18)).join("；")}
            </div>
          )}
          <Row label="关系" items={rel.rels.map((e) => `${e.target}(${e.relType ?? "rel"})`)} tone="rel" max={8} />
        </div>
      )}
    </div>
  );
}

function Row({ label, items, tone, max = 12 }: { label: string; items: string[]; tone: string; max?: number }) {
  if (!items.length) return null;
  const color = { know: "text-know", lie: "text-truthlie", reveal: "text-reveal", rel: "text-accent-soft" }[tone] ?? "text-zinc-300";
  return (
    <div className="text-[10px]">
      <span className="text-zinc-500">{label}：</span>
      <span className={color}>{items.slice(0, max).join("、")}{items.length > max ? ` …+${items.length - max}` : ""}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
