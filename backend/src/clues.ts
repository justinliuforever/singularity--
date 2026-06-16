/**
 * 线索模块：把 06_clues/clues.csv 的"实体道具卡"元数据，接上 _ocr 里 OCR 出的真实卡面内容。
 * 用于"现场模式"的角色认知卡——TA 这一幕手上拿到的线索（标题/类型/真实内容）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DIG = path.join(ROOT, "digitized", "流氓叙事");
const OCR = path.join(DIG, "_ocr");

/** 幕名 → 序号（与 compile 的图谱 meta 对齐：序幕=1 … 结局=12，开本前准备=0） */
const ACT_ORD: Record<string, number> = {
  开本前准备: 0,
  序幕: 1,
  第一幕: 2,
  第二幕: 3,
  第三幕: 4,
  第四幕: 5,
  第五幕: 6,
  第六幕: 7,
  第七幕: 8,
  无声之旅: 9,
  无所容心: 10,
  第十幕: 11,
  结局演绎剧场: 12,
};
export const actOrdOf = (name: string) => {
  const key = (name || "").trim();
  if (ACT_ORD[key] != null) return ACT_ORD[key];
  for (const k of Object.keys(ACT_ORD)) if (key.includes(k)) return ACT_ORD[k];
  return 99;
};

export interface Clue {
  id: string;
  title: string;
  actName: string;
  actOrd: number;
  relatedChars: string[];
  type: string;
  showCondition: string;
  difficulty: string;
  content: string; // OCR 出的真实卡面文字
}

/** 解析一行 CSV（处理引号字段） */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

let CACHE: Clue[] | null = null;

/** 解析 clues.csv 全部线索（懒加载缓存，OCR 内容按需读） */
function allClues(): Clue[] {
  if (CACHE) return CACHE;
  const raw = (() => {
    try { return fs.readFileSync(path.join(DIG, "06_clues", "clues.csv"), "utf8").replace(/^﻿/, ""); } catch { return ""; }
  })();
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return (CACHE = []);
  const header = parseCsvLine(lines[0]);
  const col = (name: string) => header.indexOf(name);
  const ci = {
    id: col("card_id"),
    title: col("title"),
    act: col("act"),
    related: col("related_chars"),
    type: col("type"),
    show: col("show_condition"),
    diff: col("difficulty"),
    file: col("source_file"),
    pages: col("source_pages"),
  };
  const clues: Clue[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    if (!f[ci.id]) continue;
    const actName = f[ci.act] ?? "";
    clues.push({
      id: f[ci.id],
      title: f[ci.title] ?? "",
      actName,
      actOrd: actOrdOf(actName),
      relatedChars: (f[ci.related] ?? "").split(/[;；]/).map((s) => s.trim()).filter(Boolean),
      type: f[ci.type] ?? "",
      showCondition: f[ci.show] ?? "",
      difficulty: f[ci.diff] ?? "",
      content: ocrContent(f[ci.file] ?? "", f[ci.pages] ?? ""),
    });
  }
  return (CACHE = clues);
}

/** 解析页码串 "15-16" / "15,16" / "15" → 页码数组 */
function parsePages(s: string): number[] {
  const out: number[] = [];
  for (const part of s.split(/[,，]/)) {
    const m = part.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (m) { for (let p = +m[1]; p <= +m[2]; p++) out.push(p); }
    else if (/^\d+$/.test(part.trim())) out.push(+part.trim());
  }
  return out;
}

/** 从 _ocr 取这张卡指定页的真实文字 */
function ocrContent(sourceFile: string, sourcePages: string): string {
  if (!sourceFile) return "";
  const base = path.basename(sourceFile).replace(/\.pdf$/i, "");
  // 线索卡基本都在 _ocr/线索 下；找不到再遍历其它子目录
  const candidates = ["线索", "手册", "剧本"].map((d) => path.join(OCR, d, base + ".pages.json"));
  let jsonPath = candidates.find((p) => fs.existsSync(p));
  if (!jsonPath) {
    try {
      for (const d of fs.readdirSync(OCR)) {
        const p = path.join(OCR, d, base + ".pages.json");
        if (fs.existsSync(p)) { jsonPath = p; break; }
      }
    } catch {}
  }
  if (!jsonPath) return "";
  try {
    const doc = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as { pages: string[] };
    const pages = parsePages(sourcePages);
    const picked = pages.length ? pages : doc.pages.map((_, i) => i + 1);
    const text = picked.map((p) => doc.pages[p - 1] ?? "").join("\n\n").trim();
    return text.replace(/\n{3,}/g, "\n\n").slice(0, 2000);
  } catch {
    return "";
  }
}

const matchesChar = (token: string, name: string) => {
  const t = token.replace(/[（(].*?[）)]/g, "").trim();
  return t === name || token.includes(name) || t.includes(name);
};

/** 某角色相关的全部线索（按幕序排），前端再按当前幕标"本幕新发" */
export function cluesForCharacter(name: string): Clue[] {
  return allClues()
    .filter((c) => c.relatedChars.some((t) => matchesChar(t, name)))
    .sort((a, b) => a.actOrd - b.actOrd);
}

/** 单条线索（含内容），供详情展开 */
export function clueById(id: string): Clue | null {
  return allClues().find((c) => c.id === id) ?? null;
}
