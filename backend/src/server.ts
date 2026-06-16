import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenv } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Graph } from "@liumang/shared";
import { compileGraph } from "./compile.js";
import { loadKB, buildSystemPrompt, leakAudit, callDeepSeek, analyzeTurn, tensionFromHistory, probeQuestions, followupQuestions, type Msg } from "./chat.js";
import { loadDossier, loadAct } from "./dossier.js";
import { clueById } from "./clues.js";
import { loadStory } from "./story.js";
import { auditStory } from "./audit.js";
import { solveStory } from "./solver.js";
import { previewEdit } from "./preview.js";
import { suggestInserts, suggestEdit } from "./suggest.js";
import { cascadeRewrite, cascadeScope } from "./cascade.js";
import { sceneTurn, sceneDirector, sceneSuggest, sceneReferee, sceneCast, type StageLine } from "./scene.js";

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

// P4b ①LLM 编剧助手：提议"这个事件可以改成什么"（可给方向）
app.post("/suggest-edit", async (c) => {
  try {
    const { id, direction } = await c.req.json<{ id: string; direction?: string }>();
    return c.json(await suggestEdit(id, direction));
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

// P4b 下游连锁·秒算范围（确定性，无 LLM）：返回全部受影响下游 id，前端据此分批
app.post("/cascade-scope", async (c) => {
  try {
    return c.json(cascadeScope(await c.req.json()));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// P4b 下游连锁改写：改动 delta(+可选 onlyIds 一批) → LLM 逐个提议怎么跟着改（keep/rewrite/drop）
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

// C1 同台对质：让某角色在台上说下一句（迷雾 KB + 听到的对话）
app.post("/scene/turn", async (c) => {
  try {
    const { actName, present, transcript, speaker } = await c.req.json<{ actName: string; present: string[]; transcript: StageLine[]; speaker: string }>();
    return c.json(await sceneTurn({ actName: actName || "第三幕", present: present || [], transcript: transcript || [], speaker }));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// C1 导演：建议下一个该开口的人（启发式）
app.post("/scene/director", async (c) => {
  try {
    const { actName, present, transcript } = await c.req.json<{ actName: string; present: string[]; transcript: StageLine[] }>();
    return c.json(sceneDirector({ actName: actName || "第三幕", present: present || [], transcript: transcript || [] }));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// C1.5 导演台·建议问题
app.post("/scene/suggest", async (c) => {
  try {
    const { actName, present, transcript } = await c.req.json<{ actName: string; present: string[]; transcript: StageLine[] }>();
    return c.json(await sceneSuggest({ actName: actName || "第三幕", present: present || [], transcript: transcript || [] }));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// 裁判侧·在场各人盘算（无 LLM）
app.post("/scene/cast", async (c) => {
  try {
    const { actName, present } = await c.req.json<{ actName: string; present: string[] }>();
    return c.json(sceneCast({ actName: actName || "第三幕", present: present || [] }));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// C2 裁判·跨角色对质点
app.post("/scene/referee", async (c) => {
  try {
    const { actName, present, transcript } = await c.req.json<{ actName: string; present: string[]; transcript: StageLine[] }>();
    return c.json(await sceneReferee({ actName: actName || "第三幕", present: present || [], transcript: transcript || [] }));
  } catch (e: any) {
    return c.json({ error: String(e?.message ?? e) }, 500);
  }
});

// 动态追问建议：每轮回复后，结合对话/线索/命门生成最佳"下一个问题"
app.post("/followup", async (c) => {
  try {
    const { character, actName, messages } = await c.req.json<{ character: string; actName: string; messages: Msg[] }>();
    return c.json({ qs: await followupQuestions(character || "黛利拉", actName || "第三幕", messages || []) });
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
    const msgs = body.messages || [];
    const tension = tensionFromHistory(msgs, kb);
    const system = buildSystemPrompt(kb, actName, { tension });
    const audit = leakAudit(system, kb);
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
