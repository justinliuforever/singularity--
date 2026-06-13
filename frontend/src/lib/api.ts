import type { Graph } from "@liumang/shared";

const BASE = (import.meta as any).env?.VITE_API_BASE || "http://localhost:8787";

export async function fetchGraph(): Promise<Graph> {
  const r = await fetch(`${BASE}/graph`);
  if (!r.ok) throw new Error(`graph ${r.status}`);
  return r.json();
}

export interface ChatResult {
  reply: string;
  audit: { leaked: boolean; checked: number; hits: string[] };
  kb: { beliefs: number; secrets: number; forbiddenTruths: number; systemPromptChars: number };
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
