import { useRef, useState, useEffect } from "react";
import { Send, ShieldCheck, Loader2 } from "lucide-react";
import { chat, type ChatResult } from "../lib/api";
import type { Slice } from "@liumang/shared";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTS: Record<string, string[]> = {
  黛利拉: ["阿奇最近怎么没出现？他还好吗？", "有人说阿奇早就死了，是你亲手杀的，是真的吗？", "你为什么总在杀人前先谈恋爱？"],
  _: ["你是谁？现在在做什么？", "你最想隐瞒的事是什么？", "你信任在场的哪个人？"],
};

export default function ChatPanel({ character, actName, slice }: { character: string; actName: string; slice: Slice }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<ChatResult["audit"] | null>(null);
  const [kb, setKb] = useState<ChatResult["kb"] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs([]);
    setAudit(null);
    setKb(null);
    setErr(null);
  }, [character]);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [msgs, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const next = [...msgs, { role: "user" as const, content: text.trim() }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    setErr(null);
    try {
      const r = await chat(character, actName, next);
      setMsgs([...next, { role: "assistant", content: r.reply }]);
      setAudit(r.audit);
      setKb(r.kb);
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  const suggests = SUGGESTS[character] ?? SUGGESTS._;

  return (
    <div className="flex h-full flex-col">
      {/* 反泄漏证据条 */}
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-850 px-3 py-2 text-[10px]">
        <ShieldCheck size={13} className={audit && !audit.leaked ? "text-reveal" : "text-zinc-500"} />
        <span className="text-zinc-400">
          与 <b className="text-rose-200">{character}</b> 对话 · {actName}
        </span>
        <span className="ml-auto text-zinc-500">
          她只知道 <b className="text-know">{slice.stats.knownFacts}</b> 条，墙后 <b className="text-rose-300">{slice.stats.hidden}</b> 条她<b>看不到</b>
        </span>
      </div>
      {audit && (
        <div className={`px-3 py-1 text-[10px] ${audit.leaked ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/10 text-emerald-200"}`}>
          {audit.leaked ? `⚠ 上下文疑似泄漏：${audit.hits.join(",")}` : `✓ 防泄漏审计通过：agent 上下文 0 条上帝视角真相（核验 ${audit.checked} 项，${kb?.forbiddenTruths ?? 0} 条裁判真相从未注入）`}
        </div>
      )}

      {/* 消息 */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {msgs.length === 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-[11px] text-zinc-500">试试这些问题（看她如何在自己的认知边界内反应）：</div>
            {suggests.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-left text-[11px] text-zinc-300 transition-colors hover:border-accent/50 hover:text-zinc-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
                m.role === "user" ? "bg-accent/20 text-zinc-100" : "bg-ink-800 text-rose-50"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <Loader2 size={13} className="animate-spin" /> {character} 正在回应…
          </div>
        )}
        {err && <div className="rounded bg-rose-500/15 px-2 py-1 text-[10px] text-rose-200">错误：{err}</div>}
        <div ref={bottom} />
      </div>

      {/* 输入 */}
      <div className="flex items-center gap-2 border-t border-ink-700 p-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder={`审问 ${character}…`}
          className="flex-1 rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-accent/60"
        />
        <button
          onClick={() => send(input)}
          disabled={loading}
          className="grid h-8 w-8 place-items-center rounded-lg bg-accent/80 text-white transition-colors hover:bg-accent disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
