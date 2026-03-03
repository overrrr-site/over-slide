"use client";

import type { CoverageStatus } from "../types";
import { COVERAGE_ITEMS } from "../constants";

interface CoverageTrackerProps {
  coverageStatus: CoverageStatus;
}

export function CoverageTracker({ coverageStatus }: CoverageTrackerProps) {
  const coveredCount = Object.values(coverageStatus).filter(Boolean).length;

  return (
    <div className="flex items-center gap-2 border-b border-beige bg-off-white/50 px-4 py-1.5">
      <span className="text-xs text-text-secondary">
        ヒアリング状況 ({coveredCount}/5):
      </span>
      <div className="flex gap-1.5">
        {COVERAGE_ITEMS.map((item) => {
          const covered = coverageStatus[item.key];
          return (
            <span
              key={item.key}
              title={item.label}
              className={`rounded-full px-2 py-0.5 text-xs ${
                covered
                  ? "bg-green/10 text-green"
                  : "bg-beige/50 text-text-secondary"
              }`}
            >
              {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
