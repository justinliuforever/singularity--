import type { Graph, GraphNode, GraphEdge } from "./schema.js";

/** 节点在某 (幕,视角) 下的显示态 */
export type NodeState = "full" | "dim" | "fog";

export interface Slice {
  /** nodeId -> 显示态 */
  nodeState: Record<string, NodeState>;
  /** edgeId -> 是否可见 */
  edgeVisible: Record<string, boolean>;
  perspective: string;
  act: number;
  stats: {
    full: number;
    fog: number;
    knownFacts: number;
    falseBeliefs: number;
    secrets: number;
    /** 上帝视角真相总数（隔离墙度量） */
    truthTotal: number;
    /** 该视角看不到的真相数（=隔离墙） */
    hidden: number;
  };
}

const isFact = (n: GraphNode) => n.kind === "fact";
const knowable = (n: GraphNode, act: number) => n.act != null && n.act <= act;

/**
 * 计算 G(幕, 视角)。
 * - god：截至该幕已揭示的事实/线索为 full，未来的(act>幕)为 dim，仅裁判(act==null)为 dim。角色全 full。
 * - 某角色：只 full 该角色知道/相信的事实(按获取幕 gating) + 其相关角色；其余 fog。假信念单列计数。
 */
export function sliceGraph(g: Graph, act: number, perspective: string): Slice {
  const nodeState: Record<string, NodeState> = {};
  const edgeVisible: Record<string, boolean> = {};
  const nodeById = new Map(g.nodes.map((n) => [n.id, n]));
  const truthTotal = g.nodes.filter(
    (n) => isFact(n) && (n.access === "referee" || n.act == null || true)
  ).length;

  if (perspective === "god") {
    let full = 0,
      dim = 0;
    for (const n of g.nodes) {
      if (n.kind === "character") {
        nodeState[n.id] = "full";
        full++;
      } else if (knowable(n, act)) {
        nodeState[n.id] = "full";
        full++;
      } else {
        nodeState[n.id] = "dim";
        dim++;
      }
    }
    for (const e of g.edges) {
      const s = nodeState[e.source];
      const t = nodeState[e.target];
      // god 视角只展示客观边 + REVEALS/REL；隐藏每个角色私有的 KNOWS 噪音以免糊（关系/揭示边为主）
      const show =
        s != null &&
        t != null &&
        (e.kind === "REVEALS" || e.kind === "REL" || e.kind === "TRIGGERS") &&
        (e.act == null || e.act <= act);
      edgeVisible[e.id] = !!show;
    }
    return {
      nodeState,
      edgeVisible,
      perspective,
      act,
      stats: { full, fog: 0, knownFacts: 0, falseBeliefs: 0, secrets: 0, truthTotal, hidden: 0 },
    };
  }

  // 角色视角
  const known = new Set<string>(); // 该角色知道的 fact id
  let falseBeliefs = 0,
    secrets = 0;
  const relatedChars = new Set<string>([perspective]);
  for (const e of g.edges) {
    if (e.source !== perspective) continue;
    if (e.kind === "KNOWS" || e.kind === "BELIEVES_FALSELY") {
      const f = nodeById.get(e.target);
      // 角色知道的事实：若是自身背景(act==null)则一直知道；否则按获取幕 gating
      if (f && (f.act == null || f.act <= act)) {
        known.add(e.target);
        if (e.kind === "BELIEVES_FALSELY") falseBeliefs++;
      }
    } else if (e.kind === "MUST_HIDE") {
      secrets++;
    } else if (e.kind === "REL") {
      relatedChars.add(e.target);
    }
  }

  let full = 0,
    fog = 0;
  for (const n of g.nodes) {
    let st: NodeState = "fog";
    if (n.id === perspective) st = "full";
    else if (n.kind === "character" && relatedChars.has(n.id)) st = "full";
    else if (isFact(n) && known.has(n.id)) st = "full";
    nodeState[n.id] = st;
    if (st === "full") full++;
    else fog++;
  }
  for (const e of g.edges) {
    const s = nodeState[e.source];
    const t = nodeState[e.target];
    // 角色视角只展示"属于该角色的边"，且两端可见
    const own = e.perspective === perspective || e.source === perspective;
    edgeVisible[e.id] = own && s === "full" && t === "full" && (e.act == null || e.act <= act);
  }
  const knownFacts = [...known].length;
  return {
    nodeState,
    edgeVisible,
    perspective,
    act,
    stats: {
      full,
      fog,
      knownFacts,
      falseBeliefs,
      secrets,
      truthTotal,
      hidden: truthTotal - knownFacts,
    },
  };
}

/** 取某角色在某幕的"已知事实"节点（供 chat KB 编译 / 子图展示） */
export function characterKnownFacts(g: Graph, act: number, character: string): GraphNode[] {
  const s = sliceGraph(g, act, character);
  return g.nodes.filter((n) => n.kind === "fact" && s.nodeState[n.id] === "full");
}
