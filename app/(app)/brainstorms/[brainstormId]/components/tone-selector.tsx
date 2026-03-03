"use client";

import type { BriefSheetTone } from "../types";
import { BRIEF_SHEET_TONES } from "../constants";

interface ToneSelectorProps {
  currentTone: BriefSheetTone;
  onChangeTone: (tone: BriefSheetTone) => void;
}

export function ToneSelector({
  currentTone,
  onChangeTone,
}: ToneSelectorProps) {
  return (
    <div className="flex items-center gap-2 border-b border-beige bg-off-white/50 px-4 py-1.5">
      <span className="text-xs text-text-secondary">構成トーン:</span>
      <div className="flex gap-1">
        {BRIEF_SHEET_TONES.map((tone) => {
          const isActive = currentTone === tone.key;
          return (
            <button
              key={tone.key}
              onClick={() => onChangeTone(tone.key)}
              title={tone.description}
              className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                isActive
                  ? "bg-purple-500 text-white"
                  : "bg-white text-text-secondary hover:bg-beige"
              }`}
            >
              {tone.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
