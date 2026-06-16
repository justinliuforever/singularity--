/**
 * C1 · 同台对质：多个角色 agent 公开对峙。每人只带【自己的迷雾 KB】，都听得见台上的话，
 * 但结构上守住自己的秘密、不漏墙后真相。导演(启发式)挑下一个该开口的人；裁判每句查泄漏 + 戳墙。
 */
import { loadKB, buildSystemPrompt, callDeepSeek, analyzeTurn, tensionFromHistory, type Grounding } from "./chat.js";

export interface StageLine { speaker: string; text: string }
export interface SceneTurnResult {
  speaker: string;
  text: string;
  grounding: Grounding;
  /** 安全网：这句是否疑似漏了自己的裁判真相（理论上不该发生） */
  replyLeaked: boolean;
}

/** 让某个角色在当众对质里说下一句（从自己迷雾 KB + 听到的台上对话） */
export async function sceneTurn(body: { actName: string; present: string[]; transcript: StageLine[]; speaker: string }): Promise<SceneTurnResult> {
  const { actName, present, transcript, speaker } = body;
  const kb = loadKB(speaker, actName);
  const others = present.filter((p) => p !== speaker);
  // 别人对 speaker 说的话累计 → 情绪/张力（越被逼近命门越紧绷）
  const heard = transcript.filter((t) => t.speaker !== speaker).map((t) => ({ role: "user" as const, content: t.text }));
  const tension = tensionFromHistory(heard, kb);
  const system = buildSystemPrompt(kb, actName, { tension, stage: { present: others, transcript } });
  const reply = (await callDeepSeek(system, [{ role: "user", content: `现在轮到你（${speaker}）。针对台上刚才的话，说你这一轮——一两句 + 神态/动作。` }], { maxTokens: 400, temperature: 0.92 })).trim();
  const lastOther = [...transcript].reverse().find((t) => t.speaker !== speaker)?.text ?? "";
  const grounding = analyzeTurn(lastOther, reply, kb);
  const replyLeaked = kb.forbiddenTruths.some((t) => t && t.length >= 8 && reply.includes(t.slice(0, 10)));
  return { speaker, text: reply, grounding, replyLeaked };
}

export interface CastInfo { name: string; goal: string; perceives: string; secrets: string[]; falseBeliefs: { belief: string; truth: string }[] }
/** 裁判侧·在场各人盘算：目标/处境（公开向）+ 守的秘密/误信背后真相（创作者向）。无 LLM。 */
export function sceneCast(body: { actName: string; present: string[] }): { cast: CastInfo[] } {
  const { actName, present } = body;
  return {
    cast: present.map((p) => {
      const kb = loadKB(p, actName);
      return {
        name: p,
        goal: kb.actGoals,
        perceives: kb.perceives,
        secrets: kb.secrets.map((s) => s.fact),
        falseBeliefs: kb.wallItems.filter((w) => w.kind === "false").map((w) => ({ belief: w.surface, truth: w.truth })),
      };
    }),
  };
}

/** 导演台·建议问题：按场上对话 + 各人命门，给主持几个能激化矛盾/逼出破绽的尖锐问题（不剧透） */
export async function sceneSuggest(body: { actName: string; present: string[]; transcript: StageLine[] }): Promise<{ qs: string[] }> {
  const { actName, present, transcript } = body;
  if (!process.env.DEEPSEEK_API_KEY || present.length < 2) return { qs: [] };
  const pressure = present
    .map((p) => {
      const kb = loadKB(p, actName);
      const s = [...kb.secrets.map((x) => x.fact), ...kb.falseBeliefs].slice(0, 2).map((x) => x.slice(0, 40));
      return `${p}：${s.join("；") || "（守口如瓶）"}`;
    })
    .join("\n");
  const convo = transcript.slice(-8).map((t) => `${t.speaker}：${t.text}`).join("\n");
  const sys = [
    `你是剧本杀主持，正在导一场【${present.join("、")}】的当众对质（${actName}）。`,
    `【各自可挖的方向——仅供你判断"往哪问"，绝不可在问题里透露或暗示答案】\n${pressure}`,
    transcript.length ? `【台上刚刚】\n${convo}` : `（这场戏还没开始，先抛个能让他们互相起疑的开场问题）`,
    `给 3-4 个你可以抛给全场的问题：能**挑动对立、逼某人表态、或撕开一处破绽**。每问 8~26 字、开放犀利、口语、绝不剧透答案、不要编号引号。`,
    `只输出 JSON：{"qs":["...","..."]}`,
  ].join("\n");
  try {
    const out = await callDeepSeek(sys, [{ role: "user", content: `给我 3-4 个导这场对质的尖锐问题（JSON）。` }], { maxTokens: 500, temperature: 0.85 });
    const j = JSON.parse(out.match(/\{[\s\S]*\}/)![0]);
    return { qs: (j.qs ?? []).map((q: any) => String(q).replace(/^[\s\-\d.、)）."'“”]+|["'“”\s]+$/g, "").slice(0, 40)).filter((q: string) => q.length >= 4).slice(0, 4) };
  } catch {
    return { qs: [] };
  }
}

export interface Tell { by: string; said: string; truth: string; tag: string; note: string }
const TELL_TAGS = ["掩盖", "装不知", "甩锅", "说谎", "自相矛盾"];
/** C2 裁判·洞察谁在瞒：以真相为答案钥匙，看穿"嘴上一套、实情另一套"（隐瞒/装不知/甩锅/说谎），创作者侧 */
export async function sceneReferee(body: { actName: string; present: string[]; transcript: StageLine[] }): Promise<{ points: Tell[] }> {
  const { actName, present, transcript } = body;
  const said = transcript.filter((t) => t.speaker !== "主持");
  if (!process.env.DEEPSEEK_API_KEY || said.length < 2) return { points: [] };
  const truth = present
    .map((p) => {
      const kb = loadKB(p, actName);
      const t = [...kb.secrets.map((x) => `守:${x.fact}`), ...kb.wallItems.filter((w) => w.kind === "false").map((w) => `真相:${w.truth}`)].slice(0, 4);
      return `【${p}】${t.join("；")}`;
    })
    .filter((l) => l.length > 6)
    .join("\n");
  const convo = said.map((t) => `${t.speaker}：${t.text}`).join("\n");
  const sys = [
    `你是剧本杀【裁判】，掌握上帝视角的真相钥匙。下面是各角色台上**公开说的话**。`,
    `找出谁在**嘴上一套、实情另一套**——公开说法与真相钥匙（或别人说法）相抵，本质是在**隐瞒、装不知、甩锅或说谎**。这正是看穿 ta 在演戏的关键（不是"系统对不上"，而是"角色在瞒"）。`,
    `【真相钥匙（上帝视角，玩家永远看不到）】\n${truth || "（暂无）"}`,
    `【台上公开发言】\n${convo}`,
    `只标有**实质隐瞒/说谎**的（单纯"含糊回避"别标）。每条给：by(谁) · said(他嘴上说的，≤20字) · truth(实情/真相是什么，≤24字) · tag(从「${TELL_TAGS.join("/")}」里挑最贴切的一个) · note(一句话点破 ta 在瞒什么，≤30字)。`,
    `只输出 JSON：{"points":[{"by":"","said":"","truth":"","tag":"","note":""}]}。没有真隐瞒就 {"points":[]}。`,
  ].join("\n");
  try {
    const out = await callDeepSeek(sys, [{ role: "user", content: `看穿台上谁在瞒/在装（JSON）。` }], { maxTokens: 800, temperature: 0.3 });
    const j = JSON.parse(out.match(/\{[\s\S]*\}/)![0]);
    return {
      points: (j.points ?? [])
        .slice(0, 6)
        .map((p: any) => ({ by: String(p.by ?? "").slice(0, 12), said: String(p.said ?? p.claim ?? "").slice(0, 44), truth: String(p.truth ?? p.conflict ?? "").slice(0, 44), tag: TELL_TAGS.includes(p.tag) ? p.tag : "掩盖", note: String(p.note ?? "").slice(0, 60) }))
        .filter((p: Tell) => p.by && p.said),
    };
  } catch {
    return { points: [] };
  }
}

/** 导演（启发式·无 LLM）：下一个最该开口的人——被点名/指控的优先，否则除上一位外最久没说话的 */
export function sceneDirector(body: { actName: string; present: string[]; transcript: StageLine[] }): { speaker: string; reason: string } {
  const { present, transcript } = body;
  if (!present.length) return { speaker: "", reason: "无人在场" };
  if (!transcript.length) return { speaker: present[0], reason: "开场" };
  const last = transcript[transcript.length - 1];
  for (const p of present) {
    if (p === last.speaker) continue;
    if (last.text.includes(p)) return { speaker: p, reason: "刚被点到名" };
  }
  const lastIdx: Record<string, number> = {};
  transcript.forEach((t, i) => (lastIdx[t.speaker] = i));
  const cand = present.filter((p) => p !== last.speaker).sort((a, b) => (lastIdx[a] ?? -1) - (lastIdx[b] ?? -1));
  return { speaker: cand[0] ?? present.find((p) => p !== last.speaker) ?? present[0], reason: "该接话了" };
}
