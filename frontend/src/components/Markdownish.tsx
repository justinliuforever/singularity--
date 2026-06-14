function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <b key={i} className="text-zinc-100">{p.slice(2, -2)}</b>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}

export default function Markdownish({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((ln, i) => {
        const h = ln.match(/^(#{1,4})\s+(.*)/);
        if (h)
          return (
            <div key={i} className={`font-semibold ${h[1].length <= 1 ? "mt-2.5 text-[13px] text-zinc-100" : "mt-1.5 text-[11.5px] text-accent-soft"}`}>
              {inline(h[2])}
            </div>
          );
        if (/^\s*[-*]\s+/.test(ln))
          return (
            <div key={i} className="flex gap-1.5 text-[11px] text-zinc-300">
              <span className="text-accent-soft">·</span>
              <span>{inline(ln.replace(/^\s*[-*]\s+/, ""))}</span>
            </div>
          );
        if (/^\s*>/.test(ln))
          return (
            <div key={i} className="border-l-2 border-accent/40 pl-2 text-[11px] italic text-zinc-400">
              {inline(ln.replace(/^\s*>\s?/, ""))}
            </div>
          );
        if (/^---+$/.test(ln.trim())) return <hr key={i} className="border-ink-700" />;
        if (!ln.trim()) return <div key={i} className="h-1.5" />;
        return (
          <div key={i} className="text-[11px] leading-relaxed text-zinc-300">
            {inline(ln)}
          </div>
        );
      })}
    </div>
  );
}
