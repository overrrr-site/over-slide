"use client";

import type { DiscussionMode } from "../types";
import { DISCUSSION_MODES } from "../constants";

interface ModeSelectorProps {
  currentMode: DiscussionMode;
  onChangeMode: (mode: DiscussionMode) => void;
}

export function ModeSelector({ currentMode, onChangeMode }: ModeSelectorProps) {
  return (
    <div className="flex items-center gap-1 border-b border-beige bg-white px-4 py-2">
      <span className="mr-2 text-xs text-text-secondary">モード:</span>
      {DISCUSSION_MODES.map((mode) => {
        const isActive = currentMode === mode.key;
        return (
          <button
            key={mode.key}
            onClick={() => onChangeMode(mode.key)}
            title={mode.description}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? "bg-navy text-white"
                : "bg-off-white text-text-secondary hover:bg-beige hover:text-navy"
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
