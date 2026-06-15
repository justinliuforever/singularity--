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

export interface EditOption {
  title: string;
  summary: string;
  effect: string;
  angle: string; // 这个改法的一句话角度
}

/** P4b · 让 AI 提议"这个事件可以改成什么"。可给方向(direction)，留空则给几个不同角度。 */
export async function suggestEdit(id: string, direction?: string): Promise<{ options: EditOption[]; raw?: string }> {
  const story = loadStory();
  const ev = story.events.find((e) => e.id === id);
  if (!ev) return { options: [] };
  const byId = new Map(story.events.map((e) => [e.id, e]));
  const parents = story.edges.filter((e) => e.to === id && e.type !== "contradicts").map((e) => byId.get(e.from)?.title).filter(Boolean) as string[];
  const children = story.edges.filter((e) => e.from === id && e.type !== "contradicts").map((e) => byId.get(e.to)?.title).filter(Boolean) as string[];
  const dir = (direction ?? "").trim();

  const sys = [
    `你是《流氓叙事》剧本杀资深编剧。作者想**改写**下面这个事件这一拍的内容（结构不变，只改它"发生了什么"）。`,
    ``,
    `【要改写的事件】${ev.title}`,
    ev.summary ? `  现摘要：${ev.summary}` : ``,
    (ev as any).effect ? `  现结果：${(ev as any).effect}` : ``,
    ev.actors?.length ? `  涉及：${ev.actors.map((a: any) => a.char).join("、")}` : ``,
    parents.length ? `  前因：${parents.map((p) => `「${p}」`).join("、")}` : ``,
    children.length ? `  后果：${children.map((c) => `「${c}」`).join("、")}` : ``,
    ``,
    dir ? `作者想要的改写方向：「${dir}」——请围绕它给 3 个具体写法。` : `作者没给方向，请给 3 个**不同角度**的改写（例如：加深冲突 / 反转动机 / 换一个当事人 / 埋更深的伏笔）。`,
    `每个版本给：title(新标题，≤16字)、summary(新摘要，≤45字、一句话)、effect(新结果/影响，≤30字)、angle(这个改法的角度，≤12字)。**务必简短**。`,
    `贴合世界观（莱诺家族阴谋／布雷诺两族／怒河复仇／受控燃烧）。可以大胆改，接不接得上下游不用你管——下游会由"连锁改写"另行处理。`,
    `只输出 JSON，不要解释或 markdown：`,
    `{"options":[{"title":"","summary":"","effect":"","angle":""}]}`,
  ]
    .filter(Boolean)
    .join("\n");

  const out = await callDeepSeek(sys, [{ role: "user", content: dir ? `按「${dir}」改写「${ev.title}」，给 3 个简短版本（JSON）。` : `给我 3 个改写「${ev.title}」的不同简短版本（JSON）。` }], { maxTokens: 2800, temperature: 0.9 });
  const norm = (o: any): EditOption => ({
    title: String(o.title ?? "").slice(0, 40),
    summary: String(o.summary ?? "").slice(0, 160),
    effect: String(o.effect ?? "").slice(0, 160),
    angle: String(o.angle ?? "").slice(0, 40),
  });
  try {
    const m = out.match(/\{[\s\S]*\}/);
    const j = JSON.parse(m![0]);
    const options = (j.options ?? []).slice(0, 3).map(norm).filter((o: EditOption) => o.title || o.summary);
    if (options.length) return { options };
    throw new Error("empty");
  } catch {
    // 截断兜底：逐个抠出完整的 option 对象（最后一个被切掉也能恢复前面几个）
    const objs = [...out.matchAll(/\{[^{}]*?"angle"\s*:\s*"[^"]*"[^{}]*?\}/g)];
    const options = objs.map((mm) => { try { return norm(JSON.parse(mm[0])); } catch { return null; } }).filter(Boolean).slice(0, 3) as EditOption[];
    return options.length ? { options } : { options: [], raw: out.slice(0, 300) };
  }
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
