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
