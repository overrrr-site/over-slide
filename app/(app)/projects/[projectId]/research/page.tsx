"use client";

import { ResearchControlsPanel } from "./research-controls-panel";
import { ResearchMemoPanel } from "./research-memo-panel";
import { useResearchWorkspace } from "./use-research-workspace";

export default function ResearchPage() {
  const workspace = useResearchWorkspace();

  return (
    <div className="flex h-full">
      <ResearchControlsPanel {...workspace} />
      <ResearchMemoPanel {...workspace} />
    </div>
  );
}
