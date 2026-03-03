"use client";

import { MODEL_BG_COLORS, PRIORITY_COLORS, TYPE_ICONS } from "../constants";
import type { ItemDecision, ModelReview } from "../types";

interface ReviewDetailSectionProps {
  selectedReview: ModelReview & { data: NonNullable<ModelReview["data"]> };
  getDecision: (itemKey: string) => ItemDecision;
  onSetDecision: (itemKey: string, decision: ItemDecision) => void;
}

export function ReviewDetailSection({
  selectedReview,
  getDecision,
  onSetDecision,
}: ReviewDetailSectionProps) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div
          className={`h-3 w-3 rounded-full ${
            MODEL_BG_COLORS[selectedReview.model] || "bg-navy"
          }`}
        />
        <h3 className="text-sm font-bold text-navy">
          {selectedReview.label} の詳細レビュー
        </h3>
      </div>

      <div className="space-y-4">
        {selectedReview.data.categories.map((category, ci) => (
          <div key={ci} className="rounded-lg border border-beige bg-white p-4">
            <div className="mb-3 flex items-center gap-3">
              <h3 className="flex-shrink-0 text-sm font-bold text-navy">
                {category.name}
              </h3>
              <div className="flex flex-1 items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      MODEL_BG_COLORS[selectedReview.model] || "bg-navy"
                    }`}
                    style={{ width: `${category.score}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-bold text-navy">
                  {category.score}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {category.items.map((item, ii) => {
                const itemKey = `${selectedReview.model}-${category.name}-${item.description}`;
                const decision = getDecision(itemKey);
                const isImprovement = item.type === "improvement";

                const borderClass =
                  decision === "adopted"
                    ? "border-green bg-green/5"
                    : decision === "rejected"
                      ? "border-gray-300 bg-gray-50 opacity-60"
                      : "border-beige/50 bg-off-white";

                return (
                  <div
                    key={ii}
                    className={`rounded border p-3 transition-all ${borderClass}`}
                  >
                    <div className="flex items-start gap-2">
                      <span>{TYPE_ICONS[item.type]}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {item.target_page && (
                            <span className="text-xs text-text-secondary">
                              S{item.target_page}
                            </span>
                          )}
                          {item.priority && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs ${PRIORITY_COLORS[item.priority]}`}
                            >
                              {item.priority}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-text-primary">
                          {item.description}
                        </p>
                        {item.suggestion && (
                          <p className="mt-1 text-xs italic text-green">
                            提案: {item.suggestion}
                          </p>
                        )}
                      </div>
                      {isImprovement && (
                        <div className="flex flex-shrink-0 gap-1">
                          <button
                            onClick={() => onSetDecision(itemKey, "adopted")}
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                              decision === "adopted"
                                ? "bg-green text-white"
                                : "bg-beige/30 text-text-secondary hover:bg-green/20 hover:text-green"
                            }`}
                            title="採用"
                          >
                            採用
                          </button>
                          <button
                            onClick={() => onSetDecision(itemKey, "rejected")}
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                              decision === "rejected"
                                ? "bg-gray-500 text-white"
                                : "bg-beige/30 text-text-secondary hover:bg-gray-200 hover:text-gray-600"
                            }`}
                            title="不採用"
                          >
                            不採用
                          </button>
                          <button
                            onClick={() => onSetDecision(itemKey, "pending")}
                            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                              decision === "pending"
                                ? "bg-yellow-400 text-white"
                                : "bg-beige/30 text-text-secondary hover:bg-yellow-100 hover:text-yellow-600"
                            }`}
                            title="保留"
                          >
                            保留
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
