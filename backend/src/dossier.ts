/** 角色档案 + 幕档案：把 digitized 的角色/幕数据组织成结构化 dossier 供前端浏览。 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBeliefs } from "./kbparse.js";
import { cluesForCharacter, type Clue } from "./clues.js";

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
const clean = (s: string) =>
  s.replace(/^\s*>\s?/gm, "").replace(/\n{3,}/g, "\n\n").trim();

const CN: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const actNum = (name: string) => {
  if (/序幕/.test(name)) return 0;
  const m = name.match(/第([一二三四五六七八九十]|\d+)幕/);
  return m ? (/\d/.test(m[1]) ? +m[1] : CN[m[1]]) : 99;
};

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

export function loadDossier(name: string, actName: string): Dossier {
  const dir = path.join(DIG, "03_characters", name);
  const k = read(path.join(dir, "knowledge.yaml"));
  const g = read(path.join(dir, "goals.yaml"));
  const r = read(path.join(dir, "relations.yaml"));

  const persona = clean(section(k, "persona", ["beliefs", "secrets", "goals_by_act", "perceives_by_act", "relationship_beliefs"]))
    .split("\n")
    .filter((l) => !/^\s*#/.test(l) && !/^[=\-\s]*$/.test(l))
    .map((l) => l.replace(/^\s{2,}/, "").replace(/^([一-龥A-Za-z_/]+)[:：]\s*/, "**$1**："))
    .join("\n")
    .trim();
  const coreTheme = (persona.match(/核心命题[:：]\s*([^\n]+)/)?.[1] || k.match(/核心命题[:：]\s*([^\n]+)/)?.[1] || "").trim();
  const aliases = (r.match(/aliases:\s*\[([^\]]*)\]/)?.[1] || k.match(/aliases:\s*\[([^\]]*)\]/)?.[1] || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const bsec = section(k, "beliefs", ["secrets", "goals_by_act", "perceives_by_act", "relationship_beliefs"]);
  const beliefs: Dossier["beliefs"] = parseBeliefs(bsec).map((b) => ({ statement: b.statement, true: b.isTrue, truth: b.truth }));

  const secrets: Dossier["secrets"] = [];
  const ssec = section(k, "secrets", ["goals_by_act", "perceives_by_act", "relationship_beliefs"]);
  for (const m of ssec.matchAll(/-\s*fact:\s*([\s\S]*?)(?=\n\s*-\s*fact:|$)/g)) {
    const fact = clean((m[1].match(/^([\s\S]*?)(?=\n\s*(?:hide_from|reveal_if|weight|note):)/)?.[1] ?? m[1])).replace(/\s+/g, " ");
    const reveal_if = (m[1].match(/reveal_if:\s*([^\n]+)/)?.[1] ?? "").trim();
    if (fact) secrets.push({ fact, reveal_if });
  }

  const relations: Dossier["relations"] = [];
  for (const m of r.matchAll(/-\s*target:\s*([^\n]+)\n([\s\S]*?)(?=\n\s*-\s*target:|$)/g)) {
    relations.push({
      target: m[1].trim(),
      type: (m[2].match(/type:\s*([^\n]+)/)?.[1] ?? "").trim(),
      subtype: (m[2].match(/subtype:\s*([^\n]+)/)?.[1] ?? "").trim(),
    });
  }

  // 当前幕 goals / perceives
  const pickAct = (txt: string, sectionKey: string) => {
    const sec = section(txt, sectionKey, ["perceives_by_act", "relationship_beliefs", "global_constraints", "acts"]) || txt;
    const re = new RegExp(`(?:^|\\n)\\s*${actName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}[^\\n:：]*[:：]([\\s\\S]*?)(?=\\n\\s*\\S[^\\n]*[:：]\\s*\\n|$)`);
    return clean(sec.match(re)?.[1] ?? "").replace(/\s+\n/g, "\n");
  };
  const goals = pickAct(g + "\n" + k, "goals_by_act") || pickAct(g, "acts");
  const perceives = pickAct(k, "perceives_by_act");

  // 本幕剧本正文（从 A/B/C 分卷里抽 【当前幕】 段）
  const n = actNum(actName);
  const stage = n <= 4 ? "A" : n <= 6 ? "B" : "C";
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.startsWith(stage + "_") && f.endsWith(".md")) : [];
  const file = files.find((f) => f.includes("女")) ?? files[0];
  let narrative = "";
  if (file) {
    const md = read(path.join(dir, file));
    const esc = actName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:^|\\n)#{1,4}\\s*${esc}\\s*\\n([\\s\\S]*?)(?=\\n#{1,4}\\s*(?:第[一二三四五六七八九十\\d]+幕|结局)|$)`);
    narrative = clean(md.match(re)?.[1] ?? "").slice(0, 2400);
  }

  return {
    name,
    aliases,
    persona,
    coreTheme,
    beliefs,
    secrets,
    relations,
    goals,
    perceives,
    narrative,
    clues: cluesForCharacter(name),
    knownCount: beliefs.filter((b) => b.true).length,
    falseCount: beliefs.filter((b) => !b.true).length,
    actName,
  };
}

export function loadAct(ord: number): { name: string; markdown: string } {
  const dir = path.join(DIG, "05_acts");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : [];
  const file = files.find((f) => f.startsWith(String(ord).padStart(2, "0") + "_")) ?? files.find((f) => +(f.match(/^(\d+)_/)?.[1] ?? -1) === ord);
  if (!file) return { name: `第${ord}幕`, markdown: "（暂无该幕流程数据）" };
  const md = read(path.join(dir, file)).replace(/^---[\s\S]*?---\n/, ""); // 去 frontmatter
  const name = file.replace(/^\d+_/, "").replace(/\.md$/, "").split("_")[0];
  return { name, markdown: md };
}
