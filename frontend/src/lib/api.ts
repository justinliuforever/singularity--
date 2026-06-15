import type { Graph, StoryGraph } from "@liumang/shared";

const BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:8787";

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
}

export interface ChatResult {
  reply: string;
  audit: { leaked: boolean; checked: number; hits: string[] };
  grounding?: Grounding;
  kb: { beliefs: number; secrets: number; forbiddenTruths: number; systemPromptChars: number };
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
