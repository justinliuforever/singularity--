import { create } from "zustand";
import type { StoryEvent, StoryEdge } from "@liumang/shared";
import type { Audit, Severity, PreviewResult } from "./lib/api";

/** 对现有事件的内容补丁（改标题/摘要/因果文字/角色…） */
export type EventPatch = Partial<Pick<StoryEvent, "title" | "summary" | "effect" | "motive" | "type" | "actors" | "facts">>;
/** P4 改本草稿（仅会话，不落盘） */
export interface Draft {
  addEvents: StoryEvent[];
  addEdges: StoryEdge[];
  removeEventIds: string[];
  removeEdges: { from: string; to: string }[];
  /** 改现有事件的内容（连锁改写/直接编辑） */
  updateEvents: { id: string; patch: EventPatch }[];
}
const emptyDraft = (): Draft => ({ addEvents: [], addEdges: [], removeEventIds: [], removeEdges: [], updateEvents: [] });
/** 三段流水线当前阶段 */
export type EditStage = "idle" | "frame" | "verify" | "done";

/** 两种模式 = 一引擎两面 G(幕,视角)：现场(玩家·迷雾) / 上帝(创作·全知) */
export type Mode = "scene" | "god";
/** 矩阵列过滤（上帝模式） */
export type ColFilter = "all" | "shared" | "false";
/** 矩阵列排序（上帝模式） */
export type ColOrder = "act" | "camp";
/** L2 钻取详图类型：角色故事线 / 事件详图 / 幕因果切面 */
export type DetailKind = "char" | "event" | "act";
/** 事件详图模式：探索邻域 / 推演下游(blast) / 溯源上游(trace) */
export type EventMode = "explore" | "blast" | "trace";

/**
 * 单一选择总线（brushing & linking）：关系网/矩阵/认知卡/幕轴 共享一份。
 * 共享 ID 空间：人物用名字、事实用 Fxxx，与后端图谱一致。
 */
interface UIState {
  mode: Mode;
  /** 时间轴 Z：当前幕序（图谱 ord） */
  act: number;
  /** 现场模式：进入了谁的视角（'god' = 未进入，纵览关系） */
  perspective: string;

  // —— 上帝模式·矩阵控件 ——
  filter: ColFilter;
  order: ColOrder;
  onlyTimed: boolean;

  /** 选中的事实/线索（驱动详情 + 跨视图高亮） */
  selFact: string | null;
  hoverFact: string | null;
  hoverChar: string | null;

  /** 创作画布：选中/悬停的事件 */
  selEvent: string | null;
  hoverEvent: string | null;
  /** 事件详图：模式 + 探索深度(跳数) */
  eventMode: EventMode;
  eventDepth: number;
  /** P2 影响推演：当前点亮到第几波（-1=未推演） */
  propLevel: number;
  /** P3 创作体检：报告 + 事件→最高严重度 映射（画布徽章用） */
  audit: Audit | null;
  flagged: Record<string, Severity>;
  setAudit: (a: Audit) => void;

  /** P4 改本：编辑模式 + 草稿 + 三段流水线 + 预览结果 */
  editing: boolean;
  draft: Draft;
  /** 已应用层：点"应用(本会话)"后，把草稿并入这里 → effectiveStory 永久反映（刷新即还原，不写本子） */
  applied: Draft;
  editStage: EditStage;
  preview: PreviewResult | null;
  /** 正在编辑的边（点边后弹插入/删除面板） */
  pendingEdge: { from: string; to: string } | null;
  setPendingEdge: (e: { from: string; to: string } | null) => void;
  /** 正在编辑内容的事件 id（弹编辑面板） */
  editNodeId: string | null;
  setEditNodeId: (id: string | null) => void;
  /** 下游连锁改写抽屉是否打开 */
  cascadeOpen: boolean;
  setCascadeOpen: (b: boolean) => void;
  toggleEdit: () => void;
  draftDeleteEvent: (id: string) => void;
  draftUndeleteEvent: (id: string) => void;
  draftRemoveEdge: (from: string, to: string) => void;
  draftInsert: (ev: StoryEvent, fromId: string, toId: string) => void;
  /** 改现有事件内容（同一 id 合并补丁；patch 传 null 字段不动） */
  draftUpdateEvent: (id: string, patch: EventPatch) => void;
  /** 撤掉对某事件的内容改动 */
  draftClearUpdate: (id: string) => void;
  clearDraft: () => void;
  /** 应用草稿：并入 applied 层、退出编辑（本会话生效） */
  commitDraft: () => void;
  /** 还原全部会话改动（清空 applied + draft） */
  resetSession: () => void;
  setEditStage: (s: EditStage) => void;
  setPreview: (p: PreviewResult | null) => void;

  /** L2 聚焦详图导航栈（空=L1总览，栈顶=当前详图）——支持面包屑/返回上一步 */
  detailStack: { kind: DetailKind; id: string }[];

  set: (p: Partial<UIState>) => void;
  pickFact: (id: string | null) => void;
  pickEvent: (id: string | null) => void;
  /** 钻入（压栈，跳过与栈顶重复）。进事件可带初始模式(推演/溯源) */
  openDetail: (kind: DetailKind, id: string, mode?: EventMode) => void;
  setEventMode: (m: EventMode) => void;
  setEventDepth: (d: number) => void;
  /** 返回上一步（弹栈一层） */
  backDetail: () => void;
  /** 跳到面包屑第 i 步（-1=回总览） */
  jumpDetail: (i: number) => void;
  /** 回总览（清空） */
  closeDetail: () => void;
  /** 进入某角色视角（现场模式核心动作） */
  enterChar: (id: string) => void;
  /** 切模式 */
  setMode: (m: Mode) => void;
}

export const useUI = create<UIState>((set) => ({
  mode: "scene",
  act: 4,
  perspective: "god",
  filter: "all",
  order: "act",
  onlyTimed: false,
  selFact: null,
  hoverFact: null,
  hoverChar: null,
  selEvent: null,
  hoverEvent: null,
  eventMode: "explore",
  eventDepth: 1,
  propLevel: -1,
  audit: null,
  flagged: {},
  editing: false,
  draft: emptyDraft(),
  applied: emptyDraft(),
  editStage: "idle",
  preview: null,
  pendingEdge: null,
  editNodeId: null,
  cascadeOpen: false,
  detailStack: [],

  set: (p) => set(p),
  setAudit: (a) => {
    const rank: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
    const flagged: Record<string, Severity> = {};
    for (const f of a.findings) for (const ev of f.events) if (!flagged[ev] || rank[f.severity] < rank[flagged[ev]]) flagged[ev] = f.severity;
    set({ audit: a, flagged });
  },
  setPendingEdge: (e) => set({ pendingEdge: e }),
  setEditNodeId: (id) => set({ editNodeId: id }),
  setCascadeOpen: (b) => set({ cascadeOpen: b }),
  toggleEdit: () => set((s) => ({ editing: !s.editing, draft: emptyDraft(), editStage: "idle", preview: null, pendingEdge: null, editNodeId: null, cascadeOpen: false })),
  draftDeleteEvent: (id) =>
    set((s) => (s.draft.removeEventIds.includes(id) ? {} : { draft: { ...s.draft, removeEventIds: [...s.draft.removeEventIds, id] } })),
  draftUndeleteEvent: (id) => set((s) => ({ draft: { ...s.draft, removeEventIds: s.draft.removeEventIds.filter((x) => x !== id) } })),
  draftRemoveEdge: (from, to) =>
    set((s) => (s.draft.removeEdges.some((r) => r.from === from && r.to === to) ? { pendingEdge: null } : { draft: { ...s.draft, removeEdges: [...s.draft.removeEdges, { from, to }] }, pendingEdge: null })),
  draftInsert: (ev, fromId, toId) =>
    set((s) => ({
      draft: {
        ...s.draft,
        addEvents: [...s.draft.addEvents, ev],
        addEdges: [...s.draft.addEdges, { from: fromId, to: ev.id, type: "causes", note: "（新插入）" }, { from: ev.id, to: toId, type: "causes", note: "（新插入）" }],
        removeEdges: [...s.draft.removeEdges, { from: fromId, to: toId }],
      },
      pendingEdge: null,
    })),
  draftUpdateEvent: (id, patch) =>
    set((s) => {
      const rest = s.draft.updateEvents.filter((u) => u.id !== id);
      const prev = s.draft.updateEvents.find((u) => u.id === id)?.patch ?? {};
      return { draft: { ...s.draft, updateEvents: [...rest, { id, patch: { ...prev, ...patch } }] } };
    }),
  draftClearUpdate: (id) => set((s) => ({ draft: { ...s.draft, updateEvents: s.draft.updateEvents.filter((u) => u.id !== id) } })),
  clearDraft: () => set({ draft: emptyDraft(), editStage: "idle", preview: null, pendingEdge: null }),
  commitDraft: () =>
    set((s) => ({
      applied: {
        addEvents: [...s.applied.addEvents, ...s.draft.addEvents],
        addEdges: [...s.applied.addEdges, ...s.draft.addEdges],
        removeEventIds: [...s.applied.removeEventIds, ...s.draft.removeEventIds],
        removeEdges: [...s.applied.removeEdges, ...s.draft.removeEdges],
        // 同一事件的补丁后者覆盖前者
        updateEvents: [...s.applied.updateEvents.filter((u) => !s.draft.updateEvents.some((d) => d.id === u.id)), ...s.draft.updateEvents],
      },
      draft: emptyDraft(),
      editing: false,
      editStage: "idle",
      preview: null,
      pendingEdge: null,
      editNodeId: null,
      cascadeOpen: false,
    })),
  resetSession: () => set({ applied: emptyDraft(), draft: emptyDraft(), editing: false, editStage: "idle", preview: null, pendingEdge: null, editNodeId: null, cascadeOpen: false }),
  setEditStage: (s2) => set({ editStage: s2 }),
  setPreview: (p) => set({ preview: p }),
  pickFact: (id) => set((s) => ({ selFact: s.selFact === id ? null : id })),
  pickEvent: (id) => set((s) => ({ selEvent: s.selEvent === id ? null : id })),
  openDetail: (kind, id, mode) =>
    set((s) => {
      const top = s.detailStack[s.detailStack.length - 1];
      const dup = top && top.kind === kind && top.id === id;
      return {
        detailStack: dup ? s.detailStack : [...s.detailStack, { kind, id }],
        selEvent: kind === "event" ? id : null,
        ...(kind === "event" ? { eventMode: mode ?? "explore", eventDepth: 1 } : {}),
      };
    }),
  setEventMode: (m) => set({ eventMode: m }),
  setEventDepth: (d) => set({ eventDepth: d }),
  backDetail: () => set((s) => ({ detailStack: s.detailStack.slice(0, -1) })),
  jumpDetail: (i) => set((s) => ({ detailStack: i < 0 ? [] : s.detailStack.slice(0, i + 1) })),
  closeDetail: () => set({ detailStack: [] }),
  enterChar: (id) => set({ perspective: id, selFact: null }),
  setMode: (m) => set(m === "god" ? { mode: "god", perspective: "god", selFact: null } : { mode: "scene", selFact: null }),
}));
