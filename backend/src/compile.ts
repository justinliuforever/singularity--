/**
 * 图编译器：digitized/流氓叙事 -> 类型化 Graph。
 * 全程零 Python，best-effort 解析（agent 生成的 md/yaml/csv 容错优先）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Graph, type GraphNode, type GraphEdge } from "@liumang/shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const DIG = path.join(ROOT, "digitized", "流氓叙事");

const read = (p: string): string => {
  try {
    return fs.readFileSync(p, "utf8").replace(/^﻿/, "");
  } catch {
    return "";
  }
};
const walk = (dir: string, ext = ".md"): string[] => {
  const out: string[] = [];
  const rec = (d: string) => {
    let ents: fs.Dirent[] = [];
    try {
      ents = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const fp = path.join(d, e.name);
      if (e.isDirectory()) rec(fp);
      else if (e.name.endsWith(ext)) out.push(fp);
    }
  };
  rec(dir);
  return out;
};

// ---------- 幕序 ----------
const CN: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function buildActs() {
  const dir = path.join(DIG, "05_acts");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort() : [];
  const acts: { ord: number; name: string; file: string }[] = [];
  const nameToOrd = new Map<string, number>();
  files.forEach((f, i) => {
    const m = f.match(/^(\d+)_([^.]+)\.md$/);
    const ord = m ? parseInt(m[1], 10) : i + 1;
    const name = m ? m[2].split("_")[0] : f.replace(/\.md$/, "");
    acts.push({ ord, name, file: f });
    nameToOrd.set(name, ord);
  });
  // 别名补全（线索里出现但无独立幕文件的 第八/九幕）
  if (nameToOrd.has("第七幕") && !nameToOrd.has("第八幕")) nameToOrd.set("第八幕", nameToOrd.get("无声之旅") ?? nameToOrd.get("第七幕")! + 1);
  return { acts, nameToOrd, files };
}

function actOrd(name: string | undefined, nameToOrd: Map<string, number>): number | null {
  if (!name) return null;
  const s = name.trim();
  if (nameToOrd.has(s)) return nameToOrd.get(s)!;
  if (/序幕/.test(s)) return 1;
  if (/结局|尾声/.test(s)) return 12;
  const m = s.match(/第([一二三四五六七八九十]|\d+)幕/);
  if (m) {
    const n = /\d/.test(m[1]) ? parseInt(m[1], 10) : CN[m[1]];
    return n + 1; // 序幕=1, 第一幕=2 ...
  }
  return null;
}

// ---------- 主编译 ----------
export function compileGraph(): Graph {
  const { acts, nameToOrd } = buildActs();
  const factDesc = new Map<string, string>();
  const factAct = new Map<string, number>();
  const allFactIds = new Set<string>();

  const noteFact = (id: string, desc?: string) => {
    allFactIds.add(id);
    if (desc && (!factDesc.has(id) || (factDesc.get(id)!.length < 4 && desc.length > 4)))
      factDesc.set(id, desc.replace(/\s+/g, " ").trim().slice(0, 80));
  };

  // 扫所有 md：收集 fact 描述 + reveals→fact.act
  for (const f of walk(DIG)) {
    if (f.includes("/_ocr/") || f.includes("/_poc/") || f.includes("/_QA/")) continue;
    const txt = read(f);
    // 描述：### Fxxx — desc / - **Fxxx**：desc
    for (const m of txt.matchAll(/#+\s*(F\d{3,4})\s*[—\-–]\s*([^\n]+)/g)) noteFact(m[1], m[2]);
    for (const m of txt.matchAll(/[-*]\s*\*\*(F\d{3,4})\*\*[：:]\s*([^\n]+)/g)) noteFact(m[1], m[2]);
    for (const m of txt.matchAll(/\bF\d{3,4}\b/g)) noteFact(m[0]);
    // reveals → 该文件的幕
    const reveals = [...txt.matchAll(/\[reveals:\s*(F\d{3,4})\]/g)].map((m) => m[1]);
    if (reveals.length) {
      let ord: number | null = null;
      const base = path.basename(f);
      const am = base.match(/^(\d+)_([^.]+)\.md$/); // 幕文件
      if (am) ord = parseInt(am[1], 10);
      else {
        // 线索：按上级目录名（序幕/第一幕/...）
        const parent = path.basename(path.dirname(f));
        ord = actOrd(parent, nameToOrd);
      }
      if (ord != null) for (const fid of reveals) factAct.set(fid, Math.min(factAct.get(fid) ?? 99, ord));
    }
  }

  // ---------- 角色（entities + 关系目标）----------
  const PORTRAIT = new Set(["以撒", "蒋伯驾", "程聿怀", "程走柳", "缪宏谟", "黛利拉", "羌青瓷", "阿奇", "奥丁"]);
  const charRole = new Map<string, "PC" | "NPC">();
  const charAliases = new Map<string, string[]>();
  const aliasToCanon = new Map<string, string>();

  const entTxt = read(path.join(DIG, "00_index", "entities.yaml"));
  // 逐 "- name:" 块解析
  const entBlocks = entTxt.split(/\n\s*-\s*name:\s*/).slice(1);
  for (const blk of entBlocks) {
    const name = blk.split("\n")[0].trim();
    if (!name) continue;
    const role = /role:\s*PC/.test(blk) ? "PC" : "NPC";
    const am = blk.match(/aliases:\s*\[([^\]]*)\]/);
    const aliases = am ? am[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
    charRole.set(name, role);
    charAliases.set(name, aliases);
    aliasToCanon.set(name, name);
    for (const a of aliases) aliasToCanon.set(a, name);
  }
  const canon = (n: string) => aliasToCanon.get(n.trim()) ?? n.trim();

  // ---------- 节点容器 ----------
  const nodes = new Map<string, GraphNode>();
  const ensureChar = (name: string, role: "PC" | "NPC" = "NPC") => {
    const c = canon(name);
    if (!nodes.has(c)) {
      nodes.set(c, {
        id: c,
        kind: "character",
        label: c,
        act: null,
        role: charRole.get(c) ?? role,
        aliases: charAliases.get(c) ?? [],
        image: PORTRAIT.has(c) ? `/portraits/${c}.jpg` : null,
      });
    }
    return c;
  };
  for (const [name, role] of charRole) ensureChar(name, role);

  const edges: GraphEdge[] = [];
  const edgeIds = new Set<string>();
  const addEdge = (e: Omit<GraphEdge, "id"> & { id?: string }) => {
    const id = e.id ?? `${e.kind}:${e.source}->${e.target}:${e.perspective ?? "god"}`;
    if (edgeIds.has(id)) return;
    edgeIds.add(id);
    edges.push({ act: null, perspective: "god", ...e, id });
  };

  // ---------- 角色知识：KNOWS / BELIEVES_FALSELY / MUST_HIDE ----------
  const charDir = path.join(DIG, "03_characters");
  const chars = fs.existsSync(charDir)
    ? fs.readdirSync(charDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];

  const section = (txt: string, key: string, until: string[]): string => {
    const re = new RegExp(`\\n${key}:\\s*\\n([\\s\\S]*?)(?=\\n(?:${until.join("|")}):|$)`);
    const m = txt.match(re);
    return m ? m[1] : "";
  };

  for (const ch of chars) {
    const c = ensureChar(ch, charRole.get(ch) ?? "PC");
    const kTxt = read(path.join(charDir, ch, "knowledge.yaml"));
    if (kTxt) {
      const beliefs = section(kTxt, "beliefs", ["secrets", "goals_by_act", "perceives_by_act", "relationship_beliefs"]);
      for (const m of beliefs.matchAll(/-\s*fact:\s*([^\n]+)\n([\s\S]*?)(?=\n\s*-\s*fact:|$)/g)) {
        const factLine = m[1];
        const body = m[2];
        const fids = factLine.match(/F\d{3,4}/g) ?? [];
        const isFalse = /actually_true:\s*false/.test(body);
        const stmt = (body.match(/statement:\s*([^\n]+)/)?.[1] ?? factLine).replace(/[>"]/g, "").trim().slice(0, 80);
        if (fids.length === 0) continue; // 仅图谱化带 F-id 的信念
        for (const fid of fids) {
          noteFact(fid, stmt);
          addEdge({ source: c, target: fid, kind: isFalse ? "BELIEVES_FALSELY" : "KNOWS", perspective: c, act: factAct.get(fid) ?? null });
        }
      }
      const secrets = section(kTxt, "secrets", ["goals_by_act", "perceives_by_act", "relationship_beliefs"]);
      for (const m of secrets.matchAll(/-\s*fact:\s*([^\n]+)/g)) {
        for (const fid of m[1].match(/F\d{3,4}/g) ?? []) {
          noteFact(fid);
          addEdge({ source: c, target: fid, kind: "MUST_HIDE", perspective: c, act: factAct.get(fid) ?? null });
        }
      }
    }
    // 上帝视角小传里的 [knows]/[believes_false] 标签（补充知识边，使迷雾更稠密）
    const pTxt = read(path.join(charDir, ch, "_profile.md"));
    for (const m of pTxt.matchAll(/\[(knows|believes_false):\s*(F\d{3,4})\]/g)) {
      const fid = m[2];
      noteFact(fid);
      addEdge({ source: c, target: fid, kind: m[1] === "believes_false" ? "BELIEVES_FALSELY" : "KNOWS", perspective: c, act: factAct.get(fid) ?? null });
    }
    // 关系
    const rTxt = read(path.join(charDir, ch, "relations.yaml"));
    for (const m of rTxt.matchAll(/-\s*target:\s*([^\n]+)\n([\s\S]*?)(?=\n\s*-\s*target:|$)/g)) {
      const target = canon(m[1].trim());
      if (!target || target === c) continue;
      const type = m[2].match(/type:\s*([^\n]+)/)?.[1]?.trim() ?? "rel";
      ensureChar(target, "NPC");
      addEdge({ source: c, target, kind: "REL", perspective: c, relType: type, subjective: true, label: type });
    }
  }

  // ---------- 事实节点 ----------
  for (const fid of allFactIds) {
    const a = factAct.get(fid) ?? null;
    nodes.set(fid, {
      id: fid,
      kind: "fact",
      label: factDesc.get(fid) ?? fid,
      act: a,
      access: a == null ? "referee" : "public",
    });
  }

  // ---------- 线索节点 + REVEALS ----------
  const cluesCsv = read(path.join(DIG, "06_clues", "clues.csv"));
  if (cluesCsv) {
    const rows = parseCsv(cluesCsv);
    const header = rows[0]?.map((h) => h.trim()) ?? [];
    const idx = (k: string) => header.indexOf(k);
    for (const r of rows.slice(1)) {
      const id = r[idx("card_id")]?.trim();
      if (!id) continue;
      const ord = actOrd(r[idx("act")], nameToOrd);
      nodes.set(id, {
        id,
        kind: "clue",
        label: (r[idx("title")] ?? id).trim().slice(0, 40),
        act: ord,
        clueType: r[idx("type")]?.trim(),
        difficulty: r[idx("difficulty")]?.trim(),
      });
    }
  }
  // REVEALS：每个线索 md 里的 reveals → 该文件相关线索节点
  for (const f of walk(path.join(DIG, "06_clues"))) {
    const txt = read(f);
    const fids = [...new Set([...txt.matchAll(/\[reveals:\s*(F\d{3,4})\]/g)].map((m) => m[1]))];
    if (!fids.length) continue;
    const base = path.basename(f, ".md");
    // 找 id 含该文件名关键词的线索节点（best-effort）
    const clueNodes = [...nodes.values()].filter((n) => n.kind === "clue" && (n.label.length && (base.includes(n.label.slice(0, 4)) || n.id.includes(base.slice(0, 4)))));
    const targets = clueNodes.length ? clueNodes.slice(0, 2) : [];
    for (const cn of targets) for (const fid of fids) if (nodes.has(fid)) addEdge({ source: cn.id, target: fid, kind: "REVEALS", act: cn.act });
  }

  const nodeArr = [...nodes.values()];
  const characters = nodeArr.filter((n) => n.kind === "character").map((n) => n.id);
  const stats: Record<string, number> = {
    nodes: nodeArr.length,
    edges: edges.length,
    characters: characters.length,
    facts: nodeArr.filter((n) => n.kind === "fact").length,
    clues: nodeArr.filter((n) => n.kind === "clue").length,
    knows: edges.filter((e) => e.kind === "KNOWS").length,
    believesFalsely: edges.filter((e) => e.kind === "BELIEVES_FALSELY").length,
    reveals: edges.filter((e) => e.kind === "REVEALS").length,
    rel: edges.filter((e) => e.kind === "REL").length,
  };

  const graph: Graph = {
    meta: { script: "流氓叙事", acts: acts.map((a) => ({ ord: a.ord, name: a.name })), characters, stats },
    nodes: nodeArr,
    edges,
  };
  return Graph.parse(graph);
}

// ---------- 极简 CSV ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (ch === "\r") {
        // skip
      } else cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// ---------- CLI ----------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const g = compileGraph();
  const out = path.join(__dirname, "..", "graph.json");
  fs.writeFileSync(out, JSON.stringify(g, null, 2));
  console.log("✅ graph.json 已写出 ->", out);
  console.log("stats:", g.meta.stats);
  console.log("acts:", g.meta.acts.map((a) => `${a.ord}:${a.name}`).join("  "));
}
