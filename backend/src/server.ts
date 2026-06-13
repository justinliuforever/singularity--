import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenv } from "dotenv";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Graph } from "@liumang/shared";
import { compileGraph } from "./compile.js";
import { loadKB, buildSystemPrompt, leakAudit, callDeepSeek, type Msg } from "./chat.js";

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

app.post("/chat", async (c) => {
  try {
    const body = await c.req.json<{ character: string; actName: string; messages: Msg[] }>();
    const character = body.character || "黛利拉";
    const actName = body.actName || "第三幕";
    const kb = loadKB(character, actName);
    const system = buildSystemPrompt(kb, actName);
    const audit = leakAudit(system, kb);
    const reply = await callDeepSeek(system, body.messages || []);
    return c.json({
      reply,
      audit,
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
