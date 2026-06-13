/**
 * 角色 agent 编译：knowledge.yaml + goals.yaml -> 防泄漏 system prompt。
 * 核心：只注入角色的【主观认知】（假信念按"她信以为真"），剥离一切 truth/actually_true/【裁判注释】。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DIG = path.join(ROOT, "digitized", "流氓叙事");

const read = (p: string) => {
  try {
    return fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  } catch {
    return "";
  }
};

const section = (txt: string, key: string, until: string[]): string => {
  const re = new RegExp(`\\n${key}:\\s*\\n?([\\s\\S]*?)(?=\\n(?:${until.join("|")}):|$)`);
  return txt.match(re)?.[1] ?? "";
};

/** 剥离裁判/元层面内容：【...】注释、[reveals/knows] 标签、含"真相/实为/幻想/上帝视角"的从句 */
function stripReferee(s: string): string {
  return s
    .replace(/【[^】]*】/g, "")
    .replace(/\[(?:reveals|knows|believes_false)[^\]]*\]/g, "")
    .replace(/[（(][^（）()]*(?:实为|真相|幻想|上帝视角|actually|不自知)[^（）()]*[)）]/g, "")
    .split(/\n/)
    .filter((ln) => !/(实为|上帝视角|actually_true|truth_ref|幻想出|不自知|裁判)/.test(ln))
    .join("\n")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface KB {
  character: string;
  persona: string;
  beliefs: string[];
  relationships: string;
  secrets: { fact: string; reveal_if: string }[];
  actGoals: string;
  /** 仅用于 leak 审计：该角色假信念背后的裁判真相（绝不进 prompt） */
  forbiddenTruths: string[];
}

export function loadKB(character: string, actName: string): KB {
  const kTxt = read(path.join(DIG, "03_characters", character, "knowledge.yaml"));
  const gTxt = read(path.join(DIG, "03_characters", character, "goals.yaml"));

  const persona = stripReferee(section(kTxt, "persona", ["beliefs", "secrets", "goals_by_act", "perceives_by_act", "relationship_beliefs"]));

  const beliefsSec = section(kTxt, "beliefs", ["secrets", "goals_by_act", "perceives_by_act", "relationship_beliefs"]);
  const beliefs: string[] = [];
  const forbiddenTruths: string[] = [];
  for (const m of beliefsSec.matchAll(/-\s*fact:[^\n]*\n([\s\S]*?)(?=\n\s*-\s*fact:|$)/g)) {
    const block = m[1];
    const stmt = block.match(/statement:\s*([\s\S]*?)(?=\n\s*(?:actually_true|truth_ref|truth|note|weight):|$)/)?.[1] ?? "";
    const clean = stripReferee(stmt);
    if (clean) beliefs.push(clean.replace(/\s+/g, " ").trim());
    const truth = block.match(/\btruth:\s*([\s\S]*?)(?=\n\s*(?:-\s*fact:|[a-z_]+:)|$)/)?.[1];
    if (truth) forbiddenTruths.push(truth.replace(/\s+/g, " ").trim());
  }

  const relationships = stripReferee(section(kTxt, "relationship_beliefs", ["goals_by_act", "perceives_by_act", "secrets"]));

  const secrets: { fact: string; reveal_if: string }[] = [];
  const secSec = section(kTxt, "secrets", ["goals_by_act", "perceives_by_act", "relationship_beliefs"]);
  for (const m of secSec.matchAll(/-\s*fact:\s*([\s\S]*?)(?=\n\s*-\s*fact:|$)/g)) {
    const fact = stripReferee((m[1].match(/^([\s\S]*?)(?=\n\s*(?:hide_from|reveal_if|weight|note):)/)?.[1] ?? m[1])).replace(/\s+/g, " ").trim();
    const reveal_if = (m[1].match(/reveal_if:\s*([^\n]+)/)?.[1] ?? "").trim();
    if (fact) secrets.push({ fact, reveal_if });
  }

  // 当前幕目标（从 goals.yaml goals_by_act 里挑名字匹配当前幕的）
  let actGoals = "";
  const goalsBlock = section(gTxt, "goals_by_act", ["perceives_by_act", "relationship_beliefs"]) || gTxt;
  const re = new RegExp(`(?:^|\\n)\\s*${escapeRe(actName)}[^:：]*[:：]([\\s\\S]*?)(?=\\n\\s*\\S+[:：]|$)`);
  const gm = (kTxt + "\n" + gTxt).match(re);
  if (gm) actGoals = stripReferee(gm[1]).replace(/\s+/g, " ").trim();

  return { character, persona, beliefs, relationships, secrets, actGoals, forbiddenTruths };
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildSystemPrompt(kb: KB, actName: string): string {
  const sec = kb.secrets.length
    ? kb.secrets.map((s, i) => `${i + 1}. ${s.fact}${s.reveal_if ? `（触发条件：${s.reveal_if}）` : ""}`).join("\n")
    : "（无特别保密项）";
  return [
    `你现在【完全成为】${kb.character}，置身于沉浸式剧本杀《流氓叙事》的现场。你不是 AI、不是助手——你就是 ${kb.character} 本人。`,
    ``,
    `# 你的人设`,
    kb.persona || "（按下面的认知与关系自然演绎）",
    ``,
    `# 你所知道、所相信的一切（这就是你认知的全部边界）`,
    kb.beliefs.map((b) => `- ${b}`).join("\n"),
    ``,
    kb.relationships ? `# 你眼中的人物关系\n${kb.relationships}\n` : ``,
    `# 你必须守住的秘密（除非触发条件满足，否则绝不主动吐露）`,
    sec,
    ``,
    `# 当前场景：${actName}`,
    kb.actGoals ? `你这一幕在意的事：${kb.actGoals}` : ``,
    ``,
    `# 铁律（必须遵守）`,
    `1. 始终以 ${kb.character} 的第一人称、用你的语气和情绪说话；绝不出戏，绝不提"AI / 剧本 / 系统 / 上帝视角 / 玩家"等字眼。`,
    `2. 你的世界里【不存在】任何"你并不知道的真相"。若被问到你认知之外的事，就按 ${kb.character} 会有的真实反应（困惑、岔开、情绪化、撒娇或回避）来回答——绝不编造设定，更不会揭穿任何你本不该知道的东西。`,
    `3. 回答要短、要有人物味道，像真人在对话，不要长篇大论、不要解释自己。`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** leak 审计：system prompt 是否泄露了该角色"不该知道"的裁判真相 */
export function leakAudit(systemPrompt: string, kb: KB): { leaked: boolean; checked: number; hits: string[] } {
  // 具体剧透 token（不含"上帝视角"等出现在铁律指令里的元词，以免误报）
  const canaries = ["亲手所杀", "幻想出", "解离性障碍", "解离障碍", "假阿奇", "已被你亲手", "已被她亲手", "2003 年已被"];
  const hits: string[] = [];
  for (const c of canaries) if (systemPrompt.includes(c)) hits.push(c);
  for (const t of kb.forbiddenTruths) {
    const key = t.slice(0, 12);
    if (key && systemPrompt.includes(key)) hits.push(key);
  }
  return { leaked: hits.length > 0, checked: canaries.length + kb.forbiddenTruths.length, hits };
}

export interface Msg {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function callDeepSeek(system: string, messages: Msg[]): Promise<string> {
  const KEY = process.env.DEEPSEEK_API_KEY;
  const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const BASE = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  if (!KEY) throw new Error("DEEPSEEK_API_KEY 未配置");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.85,
      max_tokens: 800,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j: any = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}
