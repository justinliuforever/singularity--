import type { Graph, StoryGraph } from "@liumang/shared";

// 部署时由 render.yaml 注入后端公网 URL；容忍带不带协议（裸 host 自动补 https）。本地默认连 localhost。
const RAW = ((import.meta as any).env?.VITE_API_BASE as string | undefined)?.trim();
const BASE = RAW ? (/^https?:\/\//.test(RAW) ? RAW : `https://${RAW}`) : "http://localhost:8787";

export async function fetchGraph(): Promise<Graph> {
  const r = await fetch(`${BASE}/graph`);
  if (!r.ok) throw new Error(`graph ${r.status}`);
  return r.json();
}

export async function fetchStory(): Promise<StoryGraph> {
  const r = await fetch(`${BASE}/story`);
  if (!r.ok) throw new Error(`story ${r.status}`);
  return r.json();
}

export type Severity = "error" | "warn" | "info";
export interface Finding {
  id: string;
  type: "contradiction" | "cycle" | "unmotivated" | "temporal" | "unsolvable";
  severity: Severity;
  title: string;
  detail: string;
  events: string[];
  bySolver?: boolean;
}
export interface Audit {
  findings: Finding[];
  stats: Record<string, number>;
  solver?: string;
}
export async function fetchAudit(): Promise<Audit> {
  const r = await fetch(`${BASE}/audit`);
  if (!r.ok) throw new Error(`audit ${r.status}`);
  return r.json();
}

export interface EditDelta {
  addEvents?: any[];
  addEdges?: { from: string; to: string; type: string; note: string }[];
  removeEventIds?: string[];
  removeEdges?: { from: string; to: string }[];
  updateEvents?: { id: string; patch: Record<string, any> }[];
}
export interface PreviewResult {
  before: Record<string, number>;
  after: { stats: Record<string, number>; findings: Finding[] };
  added: Finding[];
  cleared: Finding[];
}
export async function postPreview(delta: EditDelta, applied?: EditDelta): Promise<PreviewResult> {
  const r = await fetch(`${BASE}/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...delta, applied }) });
  if (!r.ok) throw new Error(`preview ${r.status}`);
  return r.json();
}

export interface CascadeRewrite {
  id: string;
  title: string;
  action: "keep" | "rewrite" | "drop";
  newSummary?: string;
  newEffect?: string;
  reason: string;
}
export async function cascadeScope(delta: EditDelta, applied?: EditDelta): Promise<{ affected: string[] }> {
  const r = await fetch(`${BASE}/cascade-scope`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...delta, applied }) });
  if (!r.ok) throw new Error(`cascade-scope ${r.status}`);
  return r.json();
}
export async function cascadeRewrite(delta: EditDelta, applied?: EditDelta, onlyIds?: string[]): Promise<{ affected: string[]; rewrites: CascadeRewrite[]; capped?: number }> {
  const r = await fetch(`${BASE}/cascade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...delta, applied, onlyIds }) });
  if (!r.ok) throw new Error(`cascade ${r.status}`);
  return r.json();
}

// A1 改本 → 角色认知·影响面
export type CogRel = "actor" | "knows" | "false" | "hide";
export interface CogFact { id: string; label: string; rel: CogRel; eventIds: string[] }
export interface CharImpact {
  char: string;
  direct: boolean;
  roles: string[];
  rels: CogRel[];
  facts: CogFact[];
  events: string[];
}
export interface CognitionResult {
  touched: { id: string; title: string; kind: "edited" | "downstream" }[];
  chars: CharImpact[];
  factCount: number;
}
export async function cognitionImpact(delta: EditDelta, applied?: EditDelta): Promise<CognitionResult> {
  const r = await fetch(`${BASE}/cognition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...delta, applied }) });
  if (!r.ok) throw new Error(`cognition ${r.status}`);
  return r.json();
}

// B1 加人物 · 命名充实
export interface CharRelation { target: string; type: string; why: string; exists: boolean }
/** 角色的剧情事件（dashboard 展示 + 可转成故事图 StoryEvent/边） */
export interface CharStoryEvent {
  id: string;
  type: string; // Event/Decision/Lie/Reveal/RelationChange…
  title: string;
  summary: string;
  act: string;
  actOrd: number | null;
  actOk: boolean;
  withChars: string[];
  afterId: string | null;
  afterTitle: string | null;
  leadsToId: string | null;
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
export interface SuggestCharResult { draft: CharDraft; warnings: string[]; cast: string[]; acts: string[]; raw?: string }
export async function suggestCharacter(name: string, hint: string, avoid: string[] = []): Promise<SuggestCharResult> {
  const r = await fetch(`${BASE}/character/suggest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, hint, avoid }) });
  if (!r.ok) throw new Error(`character/suggest ${r.status}`);
  return r.json();
}

export interface SuggestOption { title: string; summary: string; type: string; actors: string[] }
export async function suggestInserts(fromId: string, toId: string): Promise<{ options: SuggestOption[]; raw?: string }> {
  const r = await fetch(`${BASE}/suggest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fromId, toId }) });
  if (!r.ok) throw new Error(`suggest ${r.status}`);
  return r.json();
}

export interface EditOption { title: string; summary: string; effect: string; angle: string }
export async function suggestEdit(id: string, direction?: string): Promise<{ options: EditOption[]; raw?: string }> {
  const r = await fetch(`${BASE}/suggest-edit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, direction }) });
  if (!r.ok) throw new Error(`suggest-edit ${r.status}`);
  return r.json();
}

export interface Grounding {
  pokesWall: boolean;
  drewOn: string[];
  knownFacts: number;
  wallFacts: number;
  /** B2 测谎（创作者侧）：戳到的具体墙后项 */
  wall?: { kind: "secret" | "false"; surface: string; truth: string };
}

export interface ChatResult {
  reply: string;
  audit: { leaked: boolean; checked: number; hits: string[] };
  grounding?: Grounding;
  kb: { beliefs: number; secrets: number; forbiddenTruths: number; systemPromptChars: number };
}

// C1 同台对质
export interface StageLine { speaker: string; text: string }
export interface SceneTurnResult { speaker: string; text: string; grounding: Grounding; replyLeaked: boolean }
export async function sceneTurn(actName: string, present: string[], transcript: StageLine[], speaker: string): Promise<SceneTurnResult> {
  const r = await fetch(`${BASE}/scene/turn`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actName, present, transcript, speaker }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j;
}
export async function sceneSuggest(actName: string, present: string[], transcript: StageLine[]): Promise<string[]> {
  try {
    const r = await fetch(`${BASE}/scene/suggest`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actName, present, transcript }) });
    const j = await r.json();
    return Array.isArray(j.qs) ? j.qs : [];
  } catch {
    return [];
  }
}
export interface CastInfo { name: string; goal: string; perceives: string; secrets: string[]; falseBeliefs: { belief: string; truth: string }[] }
export async function sceneCast(actName: string, present: string[]): Promise<CastInfo[]> {
  try {
    const r = await fetch(`${BASE}/scene/cast`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actName, present }) });
    const j = await r.json();
    return Array.isArray(j.cast) ? j.cast : [];
  } catch {
    return [];
  }
}
export interface Tell { by: string; said: string; truth: string; tag: string; note: string }
export async function sceneReferee(actName: string, present: string[], transcript: StageLine[]): Promise<Tell[]> {
  try {
    const r = await fetch(`${BASE}/scene/referee`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actName, present, transcript }) });
    const j = await r.json();
    return Array.isArray(j.points) ? j.points : [];
  } catch {
    return [];
  }
}

export interface FollowupQ { q: string; tag: string }
export async function fetchFollowups(character: string, actName: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<FollowupQ[]> {
  try {
    const r = await fetch(`${BASE}/followup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ character, actName, messages }) });
    const j = await r.json();
    return Array.isArray(j.qs) ? j.qs : [];
  } catch {
    return [];
  }
}

export async function fetchProbes(name: string, act: string): Promise<string[]> {
  try {
    const r = await fetch(`${BASE}/probe/${encodeURIComponent(name)}?act=${encodeURIComponent(act)}`);
    const j = await r.json();
    return Array.isArray(j.questions) ? j.questions : [];
  } catch {
    return [];
  }
}

export async function chat(
  character: string,
  actName: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<ChatResult> {
  const r = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ character, actName, messages }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j;
}

export interface Clue {
  id: string;
  title: string;
  actName: string;
  actOrd: number;
  relatedChars: string[];
  type: string;
  showCondition: string;
  difficulty: string;
  content: string;
}

export interface Dossier {
  name: string;
  aliases: string[];
  persona: string;
  coreTheme: string;
  beliefs: { statement: string; true: boolean; truth: string }[];
  secrets: { fact: string; reveal_if: string }[];
  relations: { target: string; type: string; subtype: string }[];
  goals: string;
  perceives: string;
  narrative: string;
  clues: Clue[];
  knownCount: number;
  falseCount: number;
  actName: string;
}

export async function fetchCharacter(name: string, act: string): Promise<Dossier> {
  const r = await fetch(`${BASE}/character/${encodeURIComponent(name)}?act=${encodeURIComponent(act)}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j;
}

export async function fetchAct(ord: number): Promise<{ name: string; markdown: string }> {
  const r = await fetch(`${BASE}/act/${ord}`);
  return r.json();
}
