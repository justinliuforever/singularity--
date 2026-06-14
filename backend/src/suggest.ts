/**
 * P4a-2 · ①LLM 编剧助手：在因果链「A → B」之间，让 LLM 提议几个合理的新剧情事件。
 * 分工铁律：LLM 只【提议内容】；能否插得进、改完崩不崩，由确定性引擎划范围 + clingo 求解器判（不让 LLM 自评）。
 */
import { loadStory } from "./story.js";
import { callDeepSeek } from "./chat.js";

export interface SuggestOption {
  title: string;
  summary: string;
  type: string; // Event/Decision/Lie/Reveal/Perception/RelationChange
  actors: string[];
}

export async function suggestInserts(fromId: string, toId: string): Promise<{ options: SuggestOption[]; raw?: string }> {
  const { events } = loadStory();
  const A = events.find((e) => e.id === fromId);
  const B = events.find((e) => e.id === toId);
  if (!A || !B) return { options: [] };

  const sys = [
    `你是《流氓叙事》剧本杀的资深编剧。要在一条因果链「A → B」之间，插入一个**承上启下**的新剧情事件。`,
    ``,
    `【A（前因）】${A.title}`,
    A.summary ? `  ${A.summary}` : ``,
    A.effect ? `  （A 的后果：${A.effect}）` : ``,
    `【B（后果）】${B.title}`,
    B.summary ? `  ${B.summary}` : ``,
    ``,
    `请提议 **3 个**不同的、合理的新事件，每个都要：能被 A 自然导致、又能自然导出 B；贴合这两个事件涉及的人物与《流氓叙事》（莱诺家族阴谋/布雷诺两族/怒河复仇/受控燃烧）的世界观；不要照抄 A 或 B。`,
    `只输出 JSON，不要任何解释或 markdown：`,
    `{"options":[{"title":"简短标题","summary":"1-2句说明","type":"Event|Decision|Lie|Reveal|RelationChange","actors":["涉及角色名"]}]}`,
  ]
    .filter(Boolean)
    .join("\n");

  const out = await callDeepSeek(sys, [{ role: "user", content: `给我 3 个插入「${A.title}」与「${B.title}」之间的新剧情选项（JSON）。` }]);
  try {
    const m = out.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m![0]);
    const options: SuggestOption[] = (j.options ?? []).slice(0, 3).map((o: any) => ({
      title: String(o.title ?? "").slice(0, 40),
      summary: String(o.summary ?? "").slice(0, 120),
      type: ["Event", "Decision", "Lie", "Reveal", "RelationChange", "Perception"].includes(o.type) ? o.type : "Event",
      actors: Array.isArray(o.actors) ? o.actors.map(String).slice(0, 5) : [],
    }));
    return { options };
  } catch {
    return { options: [], raw: out.slice(0, 300) };
  }
}
