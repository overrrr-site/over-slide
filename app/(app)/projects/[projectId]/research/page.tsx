"use client";

import { useEffect } from "react";
import { ResearchControlsPanel } from "./research-controls-panel";
import { ResearchMemoPanel } from "./research-memo-panel";
import { useResearchWorkspace } from "./use-research-workspace";
import {
  useProjectChat,
  type ApplyPayload,
} from "../chat/use-project-chat";

export default function ResearchPage() {
  const workspace = useResearchWorkspace();
  const { registerApplyHandler, summarizeCurrentStep } = useProjectChat();

  // Register APPLY handler for AI assistant memo revision
  useEffect(() => {
    registerApplyHandler((payload: ApplyPayload) => {
      if (
        payload.action === "revise_memo" &&
        typeof payload.instruction === "string"
      ) {
        workspace.applyMemoRevision(payload.instruction);
      }
    });
  }, [registerApplyHandler, workspace.applyMemoRevision]);

  // Override completeResearch to summarize before navigating
  const originalCompleteResearch = workspace.completeResearch;
  const completeResearchWithSummary = async () => {
    await summarizeCurrentStep();
    await originalCompleteResearch();
  };

  return (
    <div className="flex h-full">
      <ResearchControlsPanel
        {...workspace}
        completeResearch={completeResearchWithSummary}
      />
      <ResearchMemoPanel {...workspace} />
    </div>
  );
}
