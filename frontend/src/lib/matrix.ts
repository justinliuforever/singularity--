import type { Graph } from "@liumang/shared";

/** 单元格四态：已知 / 持有的秘密(知道且须隐瞒) / 误信(假信念) / 墙后(不知) */
export type CellState = "known" | "hide" | "false" | "none";

export interface MatrixCell {
  state: CellState;
  /** 该角色"第几幕"获得此认知；null = 底层背景知识（开局即知） */
  edgeAct: number | null;
}

export interface MatrixRow {
  id: string;
  label: string;
  image: string | null;
  total: number;
}

export interface MatrixCol {
  id: string;
  label: string;
  /** 该事实"第几幕被揭示"；null = 未被线索定时揭示（背景） */
  revealAct: number | null;
  /** 持有此事实的 PC 数（已知+误信+隐瞒） */
  holders: number;
  /** 是否有人对此误信（高潮列） */
  hasFalse: boolean;
  truth?: string;
  surface?: string;
  access?: string;
}

export interface MatrixModel {
  rows: MatrixRow[];
  /** cell[charId][factId] */
  cell: Record<string, Record<string, MatrixCell>>;
  /** 全部在场事实列（未排序，未过滤） */
  allCols: MatrixCol[];
}

/** 从图谱构建认知矩阵：行=PC，列=在场事实，格=四态 */
export function buildMatrix(graph: Graph): MatrixModel {
  const pcs = graph.nodes.filter((n) => n.kind === "character" && n.role === "PC");
  const rowIds = pcs.map((p) => p.id);
  const isRow = new Set(rowIds);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  // 须隐瞒集合：`${char}|${fact}`
  const hideSet = new Set<string>();
  for (const e of graph.edges) {
    if (e.kind === "MUST_HIDE" && isRow.has(e.source)) hideSet.add(`${e.source}|${e.target}`);
  }

  const cell: MatrixModel["cell"] = {};
  for (const r of rowIds) cell[r] = {};
  const factIds = new Set<string>();

  for (const e of graph.edges) {
    if ((e.kind === "KNOWS" || e.kind === "BELIEVES_FALSELY") && isRow.has(e.source)) {
      const f = e.target;
      factIds.add(f);
      const isHide = hideSet.has(`${e.source}|${f}`);
      const state: CellState = e.kind === "BELIEVES_FALSELY" ? "false" : isHide ? "hide" : "known";
      const prev = cell[e.source][f];
      // 误信优先级最高（戏剧冲突），否则保留已有
      if (!prev || (state === "false" && prev.state !== "false")) {
        cell[e.source][f] = { state, edgeAct: e.act ?? null };
      }
    }
  }

  const allCols: MatrixCol[] = [...factIds].map((f) => {
    const n = nodeById.get(f);
    let holders = 0;
    let hasFalse = false;
    for (const r of rowIds) {
      const c = cell[r][f];
      if (c) {
        holders++;
        if (c.state === "false") hasFalse = true;
      }
    }
    return {
      id: f,
      label: n?.label ?? f,
      revealAct: n?.act ?? null,
      holders,
      hasFalse,
      truth: n?.truth,
      surface: n?.surface,
      access: n?.access,
    };
  });

  const rows: MatrixRow[] = pcs.map((p) => ({
    id: p.id,
    label: p.label,
    image: p.image ?? null,
    total: Object.keys(cell[p.id]).length,
  }));
  // 行按认知量降序（信息量大的角色靠上）
  rows.sort((a, b) => b.total - a.total);

  return { rows, cell, allCols };
}

/** 过滤 + 排序列 */
export function arrangeCols(
  m: MatrixModel,
  opts: { filter: "all" | "shared" | "false"; order: "act" | "camp"; onlyTimed: boolean }
): MatrixCol[] {
  let cols = m.allCols;
  if (opts.onlyTimed) cols = cols.filter((c) => c.revealAct != null);
  if (opts.filter === "shared") cols = cols.filter((c) => c.holders > 1);
  else if (opts.filter === "false") cols = cols.filter((c) => c.hasFalse);

  const rowIds = m.rows.map((r) => r.id);
  cols = [...cols];
  if (opts.order === "act") {
    cols.sort(
      (a, b) =>
        (a.revealAct ?? -1) - (b.revealAct ?? -1) ||
        b.holders - a.holders ||
        a.id.localeCompare(b.id)
    );
  } else {
    // seriation：按"哪些角色持有"的位掩码聚类，让知识阵营浮成色块
    const mask = (c: MatrixCol) =>
      rowIds.reduce((acc, r, i) => acc + (m.cell[r][c.id] ? 1 << i : 0), 0);
    cols.sort((a, b) => mask(b) - mask(a) || b.holders - a.holders || a.id.localeCompare(b.id));
  }
  return cols;
}

/** 客观"已揭示"状态（上帝行）：在当前幕，此事实对全场的可见性 */
export function truthState(col: MatrixCol, act: number): "revealed" | "secret" | "hidden" {
  if (col.access === "referee") return "secret";
  if (col.revealAct == null) return "revealed"; // 背景事实视为已确立
  if (col.revealAct <= act) return "revealed";
  return "hidden";
}
