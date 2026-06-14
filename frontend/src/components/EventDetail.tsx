import { useMemo } from "react";
import { X, ArrowRight, ArrowLeft, Network, Crosshair, Zap, Search } from "lucide-react";
import type { StoryGraph } from "@liumang/shared";
import { useUI } from "../store";

const TYPE_LABEL: Record<string, string> = {
  Event: "事件", Decision: "决定", Lie: "谎言/欺骗", Reveal: "揭露", RelationChange: "关系变化", Outcome: "结局", Perception: "感知", Goal: "目标",
};
const EDGE_LABEL: Record<string, string> = {
  causes: "导致", motivates: "驱动动机", enables: "使能", reveals: "揭示", depends_on: "依赖", contradicts: "矛盾于",
};

export default function EventDetail({ story, eventId, anchorId = null }: { story: StoryGraph; eventId: string; anchorId?: string | null }) {
  const { pickEvent, openDetail } = useUI();
  const e = story.events.find((x) => x.id === eventId);

  const rel = useMemo(() => {
    const out = story.edges.filter((ed) => ed.from === eventId);
    const inc = story.edges.filter((ed) => ed.to === eventId);
    const byId = new Map(story.events.map((x) => [x.id, x]));
    return {
      causes: out.map((ed) => ({ ed, ev: byId.get(ed.to) })).filter((x) => x.ev),
      causedBy: inc.map((ed) => ({ ed, ev: byId.get(ed.from) })).filter((x) => x.ev),
    };
  }, [story, eventId]);

  if (!e) return <div className="p-4 text-[12px] text-zinc-500">事件不存在</div>;
  const pcs = new Set(["程聿怀", "程走柳", "缪宏谟", "黛利拉", "以撒", "蒋伯驾"]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-2.5">
        <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-zinc-300">{TYPE_LABEL[e.type] ?? e.type}</span>
        {e.act && <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent-soft">{e.act}揭示</span>}
        {e.storyTime && <span className="text-[10px] text-zinc-500">{e.storyTime}</span>}
        <span className="ml-auto font-mono text-[10px] text-zinc-600">{e.id}</span>
        <button onClick={() => pickEvent(null)} className="text-zinc-500 hover:text-zinc-200"><X size={14} /></button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-[11px]">
        <div className="text-[14px] font-semibold leading-snug text-zinc-100">{e.title}</div>
        {e.summary && <div className="leading-relaxed text-zinc-300">{e.summary}</div>}

        {anchorId === null ? (
          <div className="rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2 text-[10px] leading-relaxed text-zinc-500">
            <b className="text-zinc-300">双击</b>此事件 → 展开因果详图（前因 / 后果 / 推演 / 溯源）
          </div>
        ) : eventId === anchorId ? (
          <div className="rounded-lg border border-accent/30 bg-accent/5 px-2.5 py-2 text-[10px] leading-relaxed text-accent-soft">
            本图<b>焦点</b> · 用左上工具条切换 因果邻域 / 推演下游 / 溯源上游
          </div>
        ) : (
          <div>
            <div className="mb-1 text-[10px] text-zinc-500">以此节点为新焦点展开：</div>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => openDetail("event", e.id, "explore")} className="flex items-center justify-center gap-1 rounded-lg border border-ink-700 bg-ink-850 py-1.5 text-[10px] text-zinc-300 transition-colors hover:border-accent/50 hover:text-white"><Network size={12} /> 因果邻域</button>
              <button onClick={() => openDetail("event", e.id, "blast")} className="flex items-center justify-center gap-1 rounded-lg border border-accent/40 bg-accent/10 py-1.5 text-[10px] text-accent-soft transition-colors hover:bg-accent/20"><Zap size={12} /> 推演下游</button>
              <button onClick={() => openDetail("event", e.id, "trace")} className="flex items-center justify-center gap-1 rounded-lg border border-amber-400/40 bg-amber-400/10 py-1.5 text-[10px] text-amber-200 transition-colors hover:bg-amber-400/20"><Search size={12} /> 溯源上游</button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {e.actors.map((a) => (
            <button
              key={a.char}
              onClick={() => openDetail("char", a.char)}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${pcs.has(a.char) ? "border-rose-400/40 text-rose-200 hover:bg-rose-400/10" : "border-ink-700 text-zinc-400 hover:bg-ink-800"}`}
              title={`${a.char} · 故事线详图`}
            >
              {a.char}<span className="text-zinc-600">·{a.role}</span>
              <Crosshair size={9} />
            </button>
          ))}
        </div>

        {e.motive && <Field label="动机" tone="text-violet-200" v={e.motive} />}
        {e.effect && <Field label="后果" tone="text-amber-200" v={e.effect} />}
        {e.facts.length > 0 && (
          <div className="text-[10px]"><span className="text-zinc-500">关联事实：</span><span className="font-mono text-know">{e.facts.join(" · ")}</span></div>
        )}

        <div className="space-y-2 border-t border-ink-700 pt-2">
          <CausalList title="由此引发" icon={<ArrowRight size={11} />} items={rel.causes} onPick={pickEvent} />
          <CausalList title="缘起于" icon={<ArrowLeft size={11} />} items={rel.causedBy} onPick={pickEvent} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, v, tone }: { label: string; v: string; tone: string }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1.5">
      <div className="mb-0.5 text-[9px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`leading-relaxed ${tone}`}>{v}</div>
    </div>
  );
}

function CausalList({ title, icon, items, onPick }: { title: string; icon: React.ReactNode; items: { ed: any; ev: any }[]; onPick: (id: string) => void }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-zinc-400">{icon} {title}（{items.length}）</div>
      <div className="space-y-1">
        {items.map(({ ed, ev }, i) => (
          <button key={i} onClick={() => onPick(ev.id)} className="block w-full rounded border border-ink-700 bg-ink-850 px-2 py-1 text-left text-[10px] transition-colors hover:border-ink-600">
            <span className="mr-1 rounded px-1 text-[8px]" style={{ background: ed.type === "contradicts" ? "#fb718522" : "#8b5cf622", color: ed.type === "contradicts" ? "#fb7185" : "#a78bfa" }}>{EDGE_LABEL[ed.type] ?? ed.type}</span>
            <span className="text-zinc-300">{ev.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
