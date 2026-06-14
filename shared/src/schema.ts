import { z } from "zod";

/** 节点种类 */
export const NodeKind = z.enum(["character", "fact", "clue", "event"]);
export type NodeKind = z.infer<typeof NodeKind>;

/** 边种类 */
export const EdgeKind = z.enum([
  "KNOWS", // 角色 -> 事实（真信念）
  "BELIEVES_FALSELY", // 角色 -> 事实（假信念，反泄漏关键）
  "MUST_HIDE", // 角色 -> 事实（秘密/保密策略）
  "REVEALS", // 线索 -> 事实
  "REL", // 角色 -> 角色（关系，主观）
  "TRIGGERS", // 幕/线索 -> 线索/演绎
]);
export type EdgeKind = z.infer<typeof EdgeKind>;

export const GraphNode = z.object({
  id: z.string(),
  kind: NodeKind,
  label: z.string(),
  /** 该节点"第几幕起可知"的序号（ordinal）。null = 仅裁判可见 / 从未被线索揭示 */
  act: z.number().nullable().default(null),
  // character
  role: z.enum(["PC", "NPC"]).optional(),
  aliases: z.array(z.string()).optional(),
  image: z.string().nullable().optional(),
  // fact
  surface: z.string().optional(),
  truth: z.string().optional(),
  access: z.enum(["public", "secret", "referee"]).optional(),
  // clue
  clueType: z.string().optional(),
  difficulty: z.string().optional(),
  // generic
  detail: z.string().optional(),
});
export type GraphNode = z.infer<typeof GraphNode>;

export const GraphEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  kind: EdgeKind,
  act: z.number().nullable().default(null),
  /** 主观视角归属：'god' 客观；或某角色名（该角色主观持有的边） */
  perspective: z.string().default("god"),
  label: z.string().optional(),
  relType: z.string().optional(),
  subjective: z.boolean().optional(),
});
export type GraphEdge = z.infer<typeof GraphEdge>;

export const ActMeta = z.object({ ord: z.number(), name: z.string() });
export type ActMeta = z.infer<typeof ActMeta>;

export const Graph = z.object({
  meta: z.object({
    script: z.string(),
    acts: z.array(ActMeta),
    characters: z.array(z.string()),
    builtAt: z.string().optional(),
    stats: z.record(z.number()).optional(),
  }),
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
});
export type Graph = z.infer<typeof Graph>;

/* ─────────────── 创作画布：故事图（事件因果层） ─────────────── */

/** 事件参与者：char + 角色定位 */
export const StoryActor = z.object({
  char: z.string(),
  role: z.string().default("agent"), // agent/patient/witness/beneficiary
});
export type StoryActor = z.infer<typeof StoryActor>;

/** 事件节点（fabula 客观事件层） */
export const StoryEvent = z.object({
  id: z.string(),
  type: z.string(), // Event/Decision/Lie/Reveal/RelationChange/Outcome/Perception/Goal
  title: z.string(),
  summary: z.string().default(""),
  storyTime: z.string().default(""), // 客观时间(可排序字符串)
  act: z.string().nullable().default(null), // 在哪一幕揭示给全场（幕名）
  actOrd: z.number().nullable().default(null), // 幕序（X 轴用）；null=纯背景
  actors: z.array(StoryActor).default([]),
  facts: z.array(z.string()).default([]),
  motive: z.string().default(""),
  effect: z.string().default(""),
});
export type StoryEvent = z.infer<typeof StoryEvent>;

/** 因果/叙事边 */
export const StoryEdge = z.object({
  from: z.string(),
  to: z.string(),
  type: z.string(), // causes/motivates/enables/reveals/depends_on/contradicts
  note: z.string().default(""),
});
export type StoryEdge = z.infer<typeof StoryEdge>;

export const StoryGraph = z.object({
  events: z.array(StoryEvent),
  edges: z.array(StoryEdge),
  /** 出现在事件里的角色（含 NPC），按事件数降序——画布泳道候选 */
  cast: z.array(z.object({ char: z.string(), count: z.number(), isPC: z.boolean() })).default([]),
  acts: z.array(ActMeta).default([]),
});
export type StoryGraph = z.infer<typeof StoryGraph>;
