import { create } from "zustand";

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
  detailStack: [],

  set: (p) => set(p),
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
