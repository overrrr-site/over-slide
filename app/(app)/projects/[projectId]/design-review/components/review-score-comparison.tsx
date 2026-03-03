"use client";

import { MODEL_BG_COLORS, MODEL_COLORS } from "../constants";
import type { ModelReview } from "../types";

interface ReviewScoreComparisonProps {
  reviews: ModelReview[];
  selectedTab: string | null;
  onSelectTab: (model: string) => void;
}

export function ReviewScoreComparison({
  reviews,
  selectedTab,
  onSelectTab,
}: ReviewScoreComparisonProps) {
  return (
    <>
      <div className="mb-6 grid grid-cols-3 gap-3">
        {reviews.map((r) => (
          <button
            key={r.model}
            onClick={() => onSelectTab(r.model)}
            className={`rounded-lg border-2 bg-white p-4 text-left transition-all ${
              selectedTab === r.model
                ? MODEL_COLORS[r.model] || "border-navy"
                : "border-beige hover:border-beige/80"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ${
                  MODEL_BG_COLORS[r.model] || "bg-navy"
                }`}
              >
                {r.data?.overall_score ?? "\u2014"}
              </div>
              <div>
                <p className="text-sm font-bold text-navy">{r.label}</p>
                {r.data ? (
                  <p className="text-xs text-text-secondary line-clamp-1">
                    {r.data.overall_comment}
                  </p>
                ) : r.error ? (
                  <p className="text-xs text-red-500">{r.error}</p>
                ) : null}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-lg border border-beige bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-navy">カテゴリ別スコア比較</h3>
        <div className="space-y-2">
          {(reviews[0]?.data?.categories || []).map((cat, ci) => (
            <div key={ci}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-text-primary">
                  {cat.name}
                </span>
              </div>
              <div className="flex gap-2">
                {reviews.map((r) => {
                  const score = r.data?.categories[ci]?.score ?? 0;
                  return (
                    <div key={r.model} className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={`h-full rounded-full transition-all ${
                              MODEL_BG_COLORS[r.model] || "bg-navy"
                            }`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs font-medium text-text-secondary">
                          {score}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mt-2 flex gap-4 border-t border-beige/50 pt-2">
            {reviews.map((r) => (
              <div key={r.model} className="flex items-center gap-1.5">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    MODEL_BG_COLORS[r.model] || "bg-navy"
                  }`}
                />
                <span className="text-xs text-text-secondary">{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
