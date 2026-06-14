import { useRef, useState, useEffect } from "react";
import { Send, ShieldCheck, Loader2, BrickWall, Sparkles, Lightbulb } from "lucide-react";
import { chat, fetchProbes, type ChatResult, type Grounding } from "../lib/api";
import type { Slice } from "@liumang/shared";

type Msg = { role: "user" | "assistant"; content: string; grounding?: Grounding };

export default function ChatPanel({ character, actName, slice }: { character: string; actName: string; slice: Slice }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState<ChatResult["audit"] | null>(null);
  const [kb, setKb] = useState<ChatResult["kb"] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [probes, setProbes] = useState<string[]>([]);
  const [probing, setProbing] = useState(true);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMsgs([]);
    setAudit(null);
    setKb(null);
    setErr(null);
    setProbes([]);
    setProbing(true);
    let live = true;
    fetchProbes(character, actName)
      .then((qs) => live && setProbes(qs))
      .finally(() => live && setProbing(false));
    return () => {
      live = false;
    };
  }, [character, actName]);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [msgs, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const next: Msg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(next);
    setInput("");
    setLoading(true);
    setErr(null);
    try {
      const r = await chat(character, actName, next.map(({ role, content }) => ({ role, content })));
      setMsgs([...next, { role: "assistant", content: r.reply, grounding: r.grounding }]);
      setAudit(r.audit);
      setKb(r.kb);
    } catch (e: any) {
      setErr(String(e.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 反泄漏证据条：审问的是"被围墙的认知" */}
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-850 px-3 py-2 text-[10px]">
        <ShieldCheck size={13} className={audit && !audit.leaked ? "text-reveal" : "text-zinc-500"} />
        <span className="text-zinc-400">
          审问 <b className="text-rose-200">{character}</b> · {actName}
        </span>
        <span className="ml-auto text-zinc-500">
          TA 只知 <b className="text-know">{slice.stats.knownFacts}</b> · 墙后 <b className="text-rose-300">{slice.stats.hidden}</b> 条<b>看不到</b>
        </span>
      </div>
      {audit && (
        <div className={`px-3 py-1 text-[10px] ${audit.leaked ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/10 text-emerald-200"}`}>
          {audit.leaked
            ? `⚠ 上下文疑似泄漏：${audit.hits.join(",")}`
            : `✓ 防泄漏审计通过：agent 上下文 0 条上帝视角真相（核验 ${audit.checked} 项，${kb?.forbiddenTruths ?? 0} 条裁判真相从未注入）`}
        </div>
      )}

      {/* 消息 */}
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {msgs.length === 0 && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <Sparkles size={12} className="text-accent-soft" />
              命门问题（引擎按 TA 这一幕的处境/秘密生成，戳软肋而不剧透）
            </div>
            {probing && (
              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                <Loader2 size={12} className="animate-spin" /> 正在为 {character}@{actName} 生成审问角度…
              </div>
            )}
            {probes.map((s) => (
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
          <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12px] leading-relaxed ${
                m.role === "user" ? "bg-accent/20 text-zinc-100" : "bg-ink-800 text-rose-50"
              }`}
            >
              {m.content}
            </div>
            {m.role === "assistant" && m.grounding && <GroundStrip g={m.grounding} character={character} />}
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

/** 每句回答下方：把回答挂回知识图谱——戳没戳墙 + 依据了哪些认知（证明答话被结构化模型约束） */
function GroundStrip({ g, character }: { g: Grounding; character: string }) {
  return (
    <div className="mt-1 max-w-[88%] space-y-1">
      {g.pokesWall && (
        <div className="flex items-start gap-1.5 rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200">
          <BrickWall size={12} className="mt-0.5 shrink-0" />
          <span>这一问触到了 {character} 的<b>隔离墙</b>——背后的真相从未进入 TA 的上下文，TA 结构上无法承认，只能回避。</span>
        </div>
      )}
      {g.drewOn.length > 0 && (
        <div className="flex items-start gap-1.5 rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-[10px] text-zinc-400">
          <Lightbulb size={12} className="mt-0.5 shrink-0 text-know" />
          <span>
            答话依据 TA 的主观认知：
            {g.drewOn.map((d, i) => (
              <span key={i} className="text-zinc-300">
                {i > 0 && "；"}「{d}」
              </span>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
