/** 健壮解析 knowledge.yaml 的 beliefs（兼容块式 `- fact:\n  statement:` 与流式 `- { fact:, statement:, actually_true: }`）。 */
export interface Belief {
  fact: string;
  statement: string;
  isTrue: boolean;
  truth: string;
}

const oneline = (s: string) => s.replace(/\s+/g, " ").trim();

export function parseBeliefs(beliefsSection: string): Belief[] {
  const out: Belief[] = [];
  const items = beliefsSection.split(/\n(?=\s*-\s)/).filter((x) => /fact\s*:/.test(x));
  for (const it of items) {
    const fact = (it.match(/fact\s*:\s*([^\n,}]+)/)?.[1] || "").trim();
    const statement =
      it.match(/statement\s*:\s*"([\s\S]*?)"/)?.[1] ??
      it.match(/statement\s*:\s*([\s\S]*?)(?=\n\s*(?:actually_true|truth_ref|truth|note|weight)\s*:|,\s*actually_true|,\s*truth|\s*\}\s*$|$)/)?.[1] ??
      "";
    const isTrue = !/actually_true\s*:\s*false/.test(it);
    const truth =
      it.match(/\btruth\s*:\s*"([\s\S]*?)"/)?.[1] ??
      it.match(/\btruth\s*:\s*([\s\S]*?)(?=\n\s*(?:-\s|[a-z_]+\s*:)|\}\s*$)/)?.[1] ??
      "";
    const st = oneline(statement);
    if (st) out.push({ fact, statement: st, isTrue, truth: oneline(truth) });
  }
  return out;
}

export const factIds = (s: string): string[] => s.match(/F\d{3,4}/g) ?? [];
