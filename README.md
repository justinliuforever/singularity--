# 流氓叙事 · 叙事图谱引擎（Demo v1）

把一个剧本杀数字化成**时序、多视角的知识图谱**，在其上演示两件事：
1. **时序叙事图谱浏览器**：拖动「幕(Z)」滑块看真相随剧情逐幕点亮；切换「视角」在上帝视角 ⇄ 角色迷雾之间切换。
2. **防泄漏角色 agent**：在任意角色视角下直接「审问」TA——agent 只拥有 TA 的主观认知（含假信念），结构上看不到上帝视角真相，**套不出墙后的反转**。

> 核心抽象 `G(幕, 视角) → 子图`。设计文档见 `../引擎与Demo设计.md`。

## 架构（前后端分离）

```
frontend/   Vite + React + React Flow + Tailwind   纯 UI
backend/    Node + Hono                            graph 编译/查询 + /chat(DeepSeek)
shared/     Zod schema + sliceGraph                前后端单一事实源
digitized/  数据（流氓叙事，已数字化）
```

- 图编译：`backend/src/compile.ts` 读 `digitized/流氓叙事/` → 320 节点 / 201 事实 / 85 线索 / 86 KNOWS 边。
- 防泄漏：`backend/src/chat.ts` 把 `knowledge.yaml` 编译成 system prompt，**剥离一切 truth/裁判注释**，并有 leak 审计（`leaked:false`）。
- LLM：DeepSeek（`deepseek-chat`=flash，可在 `.env` 切 `deepseek-reasoner`=pro）。

## 运行

前置：Node 22 + pnpm（已装）。`.env` 已含 DeepSeek key。esbuild 构建已批准（`pnpm-workspace.yaml` 的 `allowBuilds`/`onlyBuiltDependencies`）。

```bash
pnpm install            # 安装依赖
pnpm build:shared       # 构建 shared（前后端共用类型）

# 方式一：一条命令起全栈
pnpm dev

# 方式二：分别起
pnpm dev:backend        # http://localhost:8787
pnpm dev:frontend       # http://localhost:5173
```

打开 **http://localhost:5173**。

## Demo 走法

1. 默认 **上帝视角 · 第三幕**：看到完整真相图，拖「幕(Z)」滑块感受真相逐幕点亮（右下「真相解锁曲线」同步）。
2. 点顶部 **黛利拉** 切到她的视角：整图**进雾**，只剩她知道的 30 个节点；那条 **红色脉动的「假」事实** = 她坚信"阿奇还活着"（F250），而"阿奇已死"的真相节点在她视角里**根本不存在**。
3. 右侧直接 **审问黛利拉**：问"阿奇在哪""有人说你杀了阿奇"——她在角色里回避，**结构上无法承认**。顶部「防泄漏审计通过 ✓」是证据。

## 接口

- `GET /graph` — 编译好的图
- `POST /chat` `{character, actName, messages}` — 角色对话 + leak 审计
- `GET /kb/:character?act=` — 查看某角色编译出的 system prompt + 审计（调试/举证）

## 已知 v1 取舍

- 角色视角的"知识随幕增长"较弱（多数角色知识是 act=null 的背景故事）；god 视角的幕推进最明显。
- 图引擎用内存图 + 前端过滤（零数据库），多本子/多人 session 时再上图库。
- 仅 F-id 化的信念/线索进图；纯描述性信念在 KB（喂 agent）但不画进图。
