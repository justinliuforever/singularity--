import { create } from "zustand";

/** 两种模式 = 一引擎两面 G(幕,视角)：现场(玩家·迷雾) / 上帝(创作·全知) */
export type Mode = "scene" | "god";
/** 矩阵列过滤（上帝模式） */
export type ColFilter = "all" | "shared" | "false";
/** 矩阵列排序（上帝模式） */
export type ColOrder = "act" | "camp";

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

  set: (p: Partial<UIState>) => void;
  pickFact: (id: string | null) => void;
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

  set: (p) => set(p),
  pickFact: (id) => set((s) => ({ selFact: s.selFact === id ? null : id })),
  enterChar: (id) => set({ perspective: id, selFact: null }),
  setMode: (m) => set(m === "god" ? { mode: "god", perspective: "god", selFact: null } : { mode: "scene", selFact: null }),
}));
