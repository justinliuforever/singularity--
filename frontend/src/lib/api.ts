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
