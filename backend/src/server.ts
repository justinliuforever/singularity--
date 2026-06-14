import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenv } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Graph } from "@liumang/shared";
import { compileGraph } from "./compile.js";
import { loadKB, buildSystemPrompt, leakAudit, callDeepSeek, analyzeTurn, probeQuestions, type Msg } from "./chat.js";
import { loadDossier, loadAct } from "./dossier.js";
import { clueById } from "./clues.js";
import { loadStory } from "./story.js";
import { auditStory } from "./audit.js";
import { solveStory } from "./solver.js";
import { previewEdit } from "./preview.js";
import { suggestInserts } from "./suggest.js";
import { cascadeRewrite } from "./cascade.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv({ path: path.resolve(__dirname, "../../.env") });

// 启动即编译一次（毫秒级），缓存
let GRAPH: Graph;
try {
  GRAPH = compileGraph();
  console.log("✅ 图编译完成：", GRAPH.meta.stats);
} catch (e) {
  console.error("❌ 图编译失败：", e);
  throw e;
}

const app = new Hono();
app.use("*", cors());

app.get("/health", (c) => c.json({ ok: true }));
app.get("/graph", (c) => c.json(GRAPH));

// 创作画布 · 故事图（事件因果层）
app.get("/story", (c) => {
  try {
    return c.json(loadStory());
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// P4 ①LLM 编剧助手：在 A→B 之间提议新剧情选项
app.post("/suggest", async (c) => {
  try {
    const { fromId, toId } = await c.req.json<{ fromId: string; toId: string }>();
    return c.json(await suggestInserts(fromId, toId));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// P4 改本预览：草稿 delta → before→after 体检 diff（不落盘）
app.post("/preview", async (c) => {
  try {
    return c.json(await previewEdit(await c.req.json()));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// P4b 下游连锁改写：改动 delta → LLM 逐个提议下游怎么跟着改（keep/rewrite/drop）
app.post("/cascade", async (c) => {
  try {
    return c.json(await cascadeRewrite(await c.req.json()));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// 创作体检台 · 确定性图检查(P3a) + ASP 求解器(P3b)
app.get("/audit", async (c) => {
  try {
    const a = auditStory();
    const s = await solveStory();
    const rank: Record<string, number> = { error: 0, warn: 1, info: 2 };
    const findings = [...a.findings, ...s.findings].sort((x, y) => rank[x.severity] - rank[y.severity]);
    return c.json({ findings, stats: { ...a.stats, temporal: s.temporal, unsolvable: s.unsolvable }, solver: s.solver });
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

app.post("/chat", async (c) => {
  try {
    const body = await c.req.json<{ character: string; actName: string; messages: Msg[] }>();
    const character = body.character || "黛利拉";
    const actName = body.actName || "第三幕";
    const kb = loadKB(character, actName);
    const system = buildSystemPrompt(kb, actName);
    const audit = leakAudit(system, kb);
    const msgs = body.messages || [];
    const reply = await callDeepSeek(system, msgs);
    const lastQ = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
    const grounding = analyzeTurn(lastQ, reply, kb);
    return c.json({
      reply,
      audit,
      grounding,
      kb: {
        beliefs: kb.beliefs.length,
        secrets: kb.secrets.length,
        forbiddenTruths: kb.forbiddenTruths.length,
        systemPromptChars: system.length,
      },
    });
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// 角色档案（可浏览：人设/弧线/本幕目标台词/认知/秘密/关系/本幕正文）
app.get("/character/:name", (c) => {
  try {
    return c.json(loadDossier(c.req.param("name"), c.req.query("act") || "第三幕"));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// 命门建议问题（按角色×幕，模型生成+缓存）
app.get("/probe/:name", async (c) => {
  try {
    const qs = await probeQuestions(c.req.param("name"), c.req.query("act") || "第三幕");
    return c.json({ questions: qs });
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// 单条线索（含 OCR 真实卡面内容）
app.get("/clue/:id", (c) => {
  const clue = clueById(c.req.param("id"));
  return clue ? c.json(clue) : c.json({ error: "not found" }, 404);
});

// 幕档案（DM 流程）
app.get("/act/:ord", (c) => {
  try {
    return c.json(loadAct(Number(c.req.param("ord"))));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// 调试：查看某角色编译出的 system prompt + 审计（证明防泄漏）
app.get("/kb/:character", (c) => {
  const character = c.req.param("character");
  const actName = c.req.query("act") || "第三幕";
  const kb = loadKB(character, actName);
  const system = buildSystemPrompt(kb, actName);
  return c.json({ system, audit: leakAudit(system, kb), beliefs: kb.beliefs.length, forbiddenTruths: kb.forbiddenTruths });
});

const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port });
console.log(`🚀 backend on http://localhost:${port}`);
