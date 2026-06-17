/**
 * B1 · 加人物 · 命名充实（升级版：主角量级 + 落进故事图）
 *
 * 作者起名(+方向) → LLM 在现有阴谋网里把这个角色"充实"成与主角同量级的人：
 *   - 一张稠密的关系网（连多个主角 + 关键 NPC，每条有羁绊纹理）
 *   - 一条真正的剧情线：4-6 个带类型的事件(事件/决定/谎言/揭露/关系)，每个因果锚定到现有事件
 * → 引擎框定(关系连真人、事件落合法幕、锚点是真事件) → 产出可直接落进故事图的 StoryEvent[]+StoryEdge[]。
 * 仅会话、不落盘。分工铁律：LLM 提议 → 确定性引擎框定 →（下一程）ASP 盖章 → 应用。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Graph } from "@liumang/shared";
import { callDeepSeek } from "./chat.js";
import { loadStory } from "./story.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DIG = path.join(ROOT, "digitized", "流氓叙事");

const REL_TYPES = ["cp/恋人", "亲属", "家人(非血缘)", "敌友", "上下级", "同伴", "化名", "NPC关系"];
const TYPE_MAP: Record<string, string> = { 事件: "Event", 决定: "Decision", 谎言: "Lie", 揭露: "Reveal", 关系: "RelationChange", 关系变化: "RelationChange", 感知: "Perception", 目标: "Goal", 结局: "Outcome" };
const TYPE_OK = new Set(["Event", "Decision", "Lie", "Reveal", "RelationChange", "Perception", "Goal", "Outcome"]);

export interface CharRelation { target: string; type: string; why: string; exists: boolean }
/** 角色的一个剧情事件（既供 dashboard 展示，又能转成故事图 StoryEvent+边） */
export interface CharStoryEvent {
  id: string;
  type: string; // Event/Decision/Lie/Reveal/RelationChange…
  title: string;
  summary: string;
  act: string;
  actOrd: number | null;
  actOk: boolean;
  withChars: string[]; // 同场的现有角色（已解析到在册真人）
  afterId: string | null; // 因果接在哪个现有事件之后
  afterTitle: string | null;
  leadsToId: string | null; // 促成了哪个现有事件
  leadsToTitle: string | null;
  motive: string;
  effect: string;
}
export interface CharDraft {
  name: string;
  persona: string;
  want: string;
  need: string;
  conflict: string;
  secret: string;
  falseBelief?: { belief: string; truth: string };
  knows: string[];
  relations: CharRelation[];
  storyEvents: CharStoryEvent[];
  hook: string;
}
export interface SuggestCharResult {
  draft: CharDraft;
  warnings: string[];
  cast: string[];
  acts: string[];
  raw?: string;
}

function worldContext(graph: Graph) {
  const cast = graph.nodes.filter((n) => n.kind === "character").map((n) => n.id);
  const actMeta = (graph.meta?.acts ?? []) as { ord: number; name: string }[];
  let premise = "";
  try {
    premise = fs.readFileSync(path.join(DIG, "02_truth", "阴谋网.md"), "utf8").replace(/^---[\s\S]*?---/, "").replace(/\n{3,}/g, "\n\n").slice(0, 2600);
  } catch { /* 接地素材缺失也能跑 */ }
  // 现有事件清单（供因果锚定）：按幕排序，compact
  let events: { id: string; title: string; act: string; actOrd: number | null }[] = [];
  try {
    events = loadStory().events.map((e) => ({ id: e.id, title: e.title, act: e.act ?? "", actOrd: e.actOrd ?? null }));
  } catch { /* ignore */ }
  return { cast, actMeta, premise, events };
}

function resolveCast(raw: string, cast: string[], castSet: Set<string>): { target: string; exists: boolean } {
  const t = (raw ?? "").trim();
  if (!t) return { target: "", exists: false };
  if (castSet.has(t)) return { target: t, exists: true };
  const stripped = t.replace(/[（(][^）)]*[）)]/g, "").replace(/\s*[=／/].*$/, "").trim();
  if (stripped && castSet.has(stripped)) return { target: stripped, exists: true };
  const hit = cast.filter((c) => t.includes(c) || (stripped && stripped.includes(c))).sort((a, b) => b.length - a.length)[0];
  if (hit) return { target: hit, exists: true };
  return { target: stripped || t, exists: false };
}

/** 容忍围栏/前后解释；并对"被 token 截断"的 JSON 做救援：截到最后一个完整对象 + 补齐未闭合括号 */
function parseJSON(raw: string): any {
  let s = raw.replace(/```json|```/g, "").trim();
  const a = s.indexOf("{");
  if (a >= 0) s = s.slice(a);
  const tryp = (x: string): any => { try { return JSON.parse(x); } catch { return undefined; } };
  // ① 直接试完整
  const whole = tryp(s.slice(0, s.lastIndexOf("}") + 1));
  if (whole !== undefined) return whole;
  // ② 截断救援：截到最后一个 '}'（最后一个完整对象），再按括号栈补齐 ] / }
  const cut = s.lastIndexOf("}");
  if (cut > 0) {
    let t = s.slice(0, cut + 1);
    let inStr = false, esc = false;
    const st: string[] = [];
    for (const ch of t) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') inStr = !inStr;
      else if (!inStr) { if (ch === "{" || ch === "[") st.push(ch); else if (ch === "}" || ch === "]") st.pop(); }
    }
    while (st.length) t += st.pop() === "{" ? "}" : "]";
    const salv = tryp(t);
    if (salv !== undefined) return salv;
  }
  throw new Error("JSON 解析失败");
}

const slug = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 6) || "X";

export async function suggestCharacter(graph: Graph, body: { name?: string; hint?: string; avoid?: string[] }): Promise<SuggestCharResult> {
  const name = (body.name ?? "").trim();
  const hint = (body.hint ?? "").trim();
  const avoid = (body.avoid ?? []).map((s) => String(s).trim()).filter(Boolean);
  const { cast, actMeta, premise, events } = worldContext(graph);
  const castSet = new Set(cast);
  const actNames = actMeta.map((a) => a.name);
  const actSet = new Set(actNames);
  const ordOfAct = new Map(actMeta.map((a) => [a.name, a.ord]));
  const evById = new Map(events.map((e) => [e.id, e]));
  const eventList = events
    .slice()
    .sort((a, b) => (a.actOrd ?? 99) - (b.actOrd ?? 99))
    .map((e) => `${e.id}｜${e.title}${e.act ? `（${e.act}）` : ""}`)
    .join("\n");

  const sys = `你是顶尖剧本杀编剧。在下面给定的世界观里，为作者${name ? `命名的角色「${name}」` : "一个全新角色"}做"充实/设计"。
要求把 ta 写成与主角同一量级的人——稠密的关系、一条贯穿数幕、与现有阴谋网咬合的剧情线，而不是一个挂在边缘、只有一两条线的小配角。

# 世界观（仅你可见，用来接地，别照抄原文）
${premise || "（暂无接地素材，请凭名字与方向自洽创作。）"}

# 现有人物（关系/同场角色只能从这里选）
${cast.join("、")}

# 现有事件（你的剧情事件要因果锚定到这些里——用 afterId/leadsToId 指它们的 id）
${eventList}

# 幕次（事件只能落到这些幕）
${actNames.join(" → ")}

# 关系 type： ${REL_TYPES.join(" / ")}
# 事件 type： 事件 / 决定 / 谎言 / 揭露 / 关系（揭露=揭穿真相，谎言=主动欺瞒，决定=关键抉择）

# 【命名铁律】（最重要，先满足）
${name
    ? `作者已命名为「${name}」，name 字段必须原样用这个名字。`
    : `name 必须是你原创的、全新的中文人名，且【绝对不能】等于下列任何一个已存在的名字（这些都已被占用，重名会冲突）：
${[...new Set([...cast, ...avoid])].join("、")}
起好名字后，再在心里核对一遍：它确实不在上面这串里，也不是其中任何一个的明显变体。`}

# 硬要求（决定质量）
1. want(表层想要) 与 need(深层真正缺) 必须不同，中间有 conflict 的两难撕扯。
2. 关系：**5-7 条**，至少连 3 个不同主角(程聿怀/程走柳/缪宏谟/黛利拉/以撒/蒋伯驾) + 关键 NPC；每条写清羁绊与为什么，别泛泛。
3. 剧情线：**4-6 个事件**，类型要多样(至少各有一个 决定 / 谎言或揭露)，**贯穿至少 3 个不同幕**；每个事件：
   - 必须用 afterId 因果锚定到一个现有事件（也可再用 leadsToId 指出 ta 促成了哪个现有事件）；
   - withChars 写同场的现有角色；motive/effect 写清动机与后果；
   - 让这条线真正搅动主线：触发/解释/反转某个现有情节，而不是平行旁支。
${hint ? `4. 作者给的方向（务必贴合并放大）：${hint}` : "4. 作者没给方向：自己找一个最能搅动现有阴谋网中心的位置（不要边缘化）。"}
中文。只输出 JSON，不要任何解释。`;

  const schema = `{
 "name":"${name || "贴合的名字"}",
 "persona":"2-3句身份/气质/来历",
 "want":"表层想要","need":"深层真正缺","conflict":"核心两难",
 "secret":"守的秘密","falseBelief":{"belief":"ta误信什么","truth":"实情"},
 "knows":["知道的关键真相1","2","3"],
 "relations":[{"target":"现有人物名","type":"type之一","why":"羁绊/为什么(具体)"}],
 "storyEvents":[{"type":"事件/决定/谎言/揭露/关系","title":"事件名","summary":"一句话讲清发生了什么","act":"哪一幕","withChars":["同场现有角色"],"afterId":"现有事件id(必填)","leadsToId":"现有事件id或空","motive":"动机","effect":"后果/影响主线之处"}],
 "hook":"一句话：这个角色为什么是主线级、值得放进来"
}`;

  const raw = await callDeepSeek(sys, [{ role: "user", content: `严格按此结构输出 JSON（关系 5-7 条、事件 4-6 个，每条简洁写完）：\n${schema}` }], { maxTokens: 7000, temperature: 0.85 });

  let obj: any;
  try { obj = parseJSON(raw); } catch {
    return { draft: emptyDraft(name), warnings: ["模型输出未能解析为结构化草稿，请重试或调整方向。"], cast, acts: actNames, raw };
  }

  const warnings: string[] = [];
  const relations: CharRelation[] = (Array.isArray(obj.relations) ? obj.relations : [])
    .map((r: any) => {
      const { target, exists } = resolveCast(String(r?.target ?? ""), cast, castSet);
      if (target && !exists) warnings.push(`关系指向「${target}」不在现有人物里，已标注待核。`);
      return { target, type: String(r?.type ?? "NPC关系").trim(), why: String(r?.why ?? "").trim(), exists };
    })
    .filter((r: CharRelation) => r.target);

  const charName = String(obj.name ?? name ?? "").trim() || name || "（未命名）";
  const storyEvents: CharStoryEvent[] = (Array.isArray(obj.storyEvents) ? obj.storyEvents : []).map((s: any, i: number) => {
    const act = String(s?.act ?? "").trim();
    const actOk = actSet.has(act);
    if (act && !actOk) warnings.push(`事件「${s?.title ?? ""}」落在「${act}」不是合法幕次，已标注待核。`);
    const withChars = (Array.isArray(s?.withChars) ? s.withChars : [])
      .map((c: any) => resolveCast(String(c), cast, castSet))
      .filter((r: any) => r.exists)
      .map((r: any) => r.target);
    const afterId = evById.has(String(s?.afterId)) ? String(s.afterId) : null;
    if (s?.afterId && !afterId) warnings.push(`事件「${s?.title ?? ""}」的因果锚点「${s.afterId}」不是现有事件，已断开。`);
    const leadsToId = evById.has(String(s?.leadsToId)) ? String(s.leadsToId) : null;
    return {
      id: `NC_${slug(charName)}_${i + 1}`,
      type: TYPE_OK.has(String(s?.type)) ? String(s.type) : TYPE_MAP[String(s?.type ?? "").trim()] ?? "Event",
      title: String(s?.title ?? "").trim(),
      summary: String(s?.summary ?? "").trim(),
      act,
      actOrd: ordOfAct.get(act) ?? null,
      actOk,
      withChars,
      afterId,
      afterTitle: afterId ? evById.get(afterId)!.title : null,
      leadsToId,
      leadsToTitle: leadsToId ? evById.get(leadsToId)!.title : null,
      motive: String(s?.motive ?? "").trim(),
      effect: String(s?.effect ?? "").trim(),
    };
  }).filter((s: CharStoryEvent) => s.title);

  const fb = obj.falseBelief && (obj.falseBelief.belief || obj.falseBelief.truth)
    ? { belief: String(obj.falseBelief.belief ?? "").trim(), truth: String(obj.falseBelief.truth ?? "").trim() }
    : undefined;

  const draft: CharDraft = {
    name: charName,
    persona: String(obj.persona ?? "").trim(),
    want: String(obj.want ?? "").trim(),
    need: String(obj.need ?? "").trim(),
    conflict: String(obj.conflict ?? "").trim(),
    secret: String(obj.secret ?? "").trim(),
    falseBelief: fb,
    knows: (Array.isArray(obj.knows) ? obj.knows : []).map((k: any) => String(k).trim()).filter(Boolean),
    relations,
    storyEvents,
    hook: String(obj.hook ?? "").trim(),
  };
  if (castSet.has(draft.name)) warnings.push(`「${draft.name}」与现有人物重名——建议改名。`);

  return { draft, warnings, cast, acts: actNames, raw };
}

function emptyDraft(name: string): CharDraft {
  return { name: name || "（未命名）", persona: "", want: "", need: "", conflict: "", secret: "", knows: [], relations: [], storyEvents: [], hook: "" };
}
