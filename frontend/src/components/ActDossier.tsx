import { useState, useEffect } from "react";
import { X, Clapperboard } from "lucide-react";
import { fetchAct } from "../lib/api";
import Markdownish from "./Markdownish";

export default function ActDossier({ ord, name, onClose }: { ord: number; name: string; onClose: () => void }) {
  const [md, setMd] = useState<string | null>(null);
  useEffect(() => {
    setMd(null);
    fetchAct(ord).then((r) => setMd(r.markdown)).catch(() => setMd("（加载失败）"));
  }, [ord]);

  return (
    <div className="absolute inset-0 z-20 flex justify-start bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-[560px] max-w-[80%] overflow-y-auto border-r border-ink-700 bg-ink-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center gap-2 border-b border-ink-700 bg-ink-900/95 px-4 py-3 backdrop-blur">
          <Clapperboard size={15} className="text-accent-soft" />
          <div className="text-[13px] font-semibold text-zinc-100">幕档案 · {name}</div>
          <span className="text-[10px] text-zinc-500">DM 主持流程 / 触发 / BGM / 线索发放 / 演绎</span>
          <button onClick={onClose} className="ml-auto text-zinc-500 hover:text-zinc-200">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          {md == null ? <div className="animate-pulse text-[11px] text-zinc-600">加载本幕流程…</div> : <Markdownish text={md} />}
        </div>
      </div>
    </div>
  );
}
