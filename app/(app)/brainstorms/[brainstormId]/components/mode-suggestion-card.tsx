"use client";

import type { DiscussionMode } from "../types";
import { DISCUSSION_MODES } from "../constants";

interface ModeSuggestionCardProps {
  suggestedMode: DiscussionMode;
  onAccept: () => void;
  onDismiss: () => void;
}

export function ModeSuggestionCard({
  suggestedMode,
  onAccept,
  onDismiss,
}: ModeSuggestionCardProps) {
  const modeConfig = DISCUSSION_MODES.find((m) => m.key === suggestedMode);
  if (!modeConfig) return null;

  return (
    <div className="mx-auto my-2 max-w-md rounded-lg border border-green/30 bg-green/5 p-3">
      <p className="text-xs text-text-primary">
        「<span className="font-bold text-navy">{modeConfig.label}</span>
        」モードに切り替えませんか？
      </p>
      <p className="mt-0.5 text-xs text-text-secondary">
        {modeConfig.description}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onAccept}
          className="rounded-md bg-navy px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-navy/90"
        >
          切り替える
        </button>
        <button
          onClick={onDismiss}
          className="rounded-md px-3 py-1 text-xs text-text-secondary transition-colors hover:bg-off-white"
        >
          このまま続ける
        </button>
      </div>
    </div>
  );
}
