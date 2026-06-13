import { useEffect, useMemo, useState } from "react";
import { sliceGraph, type Graph, type GraphNode } from "@liumang/shared";
import { fetchGraph } from "./lib/api";
import { computeLayout, type Positions } from "./lib/layout";
import GraphCanvas from "./components/GraphCanvas";
import TopBar from "./components/TopBar";
import Inspector from "./components/Inspector";
import ChatPanel from "./components/ChatPanel";
import TensionCurve from "./components/TensionCurve";

export default function App() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [positions, setPositions] = useState<Positions>({});
  const [act, setAct] = useState(4);
  const [perspective, setPerspective] = useState("god");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetchGraph()
      .then((g) => {
        setGraph(g);
        setPositions(computeLayout(g));
        const third = g.meta.acts.find((a) => a.name === "第三幕");
        if (third) setAct(third.ord);
      })
      .catch((e) => setErr(String(e.message ?? e)));
  }, []);

  const slice = useMemo(() => (graph ? sliceGraph(graph, act, perspective) : null), [graph, act, perspective]);
  const curActName = useMemo(
    () => graph?.meta.acts.find((a) => a.ord === act)?.name ?? `第${act}幕`,
    [graph, act]
  );

  function pickPerspective(p: string) {
    setPerspective(p);
    const node = graph?.nodes.find((n) => n.id === p) ?? null;
    setSelected(p === "god" ? null : node);
  }

  if (err)
    return (
      <div className="grid h-full place-items-center text-center text-rose-300">
        <div>
          <div className="text-sm">无法连接后端</div>
          <div className="mt-1 text-[11px] text-zinc-500">{err}</div>
          <div className="mt-2 text-[11px] text-zinc-600">请确认后端已启动：<code>pnpm dev:backend</code>（:8787）</div>
        </div>
      </div>
    );
  if (!graph || !slice)
    return (
      <div className="grid h-full place-items-center text-zinc-500">
        <div className="animate-pulse text-sm">编译叙事图谱…</div>
      </div>
    );

  return (
    <div className="flex h-full flex-col">
      <TopBar graph={graph} act={act} setAct={setAct} perspective={perspective} setPerspective={pickPerspective} slice={slice} />
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <GraphCanvas
            graph={graph}
            slice={slice}
            positions={positions}
            perspective={perspective}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
          />
          {perspective !== "god" && (
            <div className="pointer-events-none absolute left-4 top-4 rounded-lg border border-rose-400/30 bg-ink-900/85 px-3 py-1.5 text-[11px] text-rose-200 backdrop-blur">
              迷雾视角：你看到的是 <b>{perspective}</b> 所知的世界 · 灰色 = 她认知之外的真相
            </div>
          )}
        </div>

        {/* 右栏 */}
        <aside className="flex w-[372px] shrink-0 flex-col border-l border-ink-700 bg-ink-900">
          <div className="max-h-[42%] shrink-0 overflow-y-auto border-b border-ink-700">
            <Inspector graph={graph} node={selected} />
          </div>
          <div className="min-h-0 flex-1">
            {perspective === "god" ? (
              <div className="overflow-y-auto">
                <TensionCurve graph={graph} act={act} />
                <div className="px-4 pb-4 text-[10px] leading-relaxed text-zinc-500">
                  <div className="mb-1 font-medium text-zinc-400">怎么看</div>
                  拖动右上 <b>幕(Z)</b> 滑块看真相随剧情点亮；切到某个 <b>角色视角</b>，整图进雾——只剩 TA 知道的，
                  墙后真相（🔒）TA 永远看不到。切到角色后右侧可直接 <b>审问</b> TA。
                </div>
              </div>
            ) : (
              <ChatPanel character={perspective} actName={curActName} slice={slice} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
