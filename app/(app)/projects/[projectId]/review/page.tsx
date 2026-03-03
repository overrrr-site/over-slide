"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ReviewItem {
  type: "improvement" | "positive" | "warning";
  target_page?: number;
  description: string;
  suggestion?: string;
  priority?: "high" | "medium" | "low";
}

interface ReviewCategory {
  name: string;
  score: number;
  items: ReviewItem[];
}

interface ReviewData {
  overall_score: number;
  overall_comment: string;
  categories: ReviewCategory[];
}

interface ModelReview {
  model: string;
  label: string;
  data: ReviewData | null;
  error?: string;
}

export default function ReviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [reviews, setReviews] = useState<ModelReview[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [deepMode, setDeepMode] = useState(false);

  // Load existing review
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("reviews")
        .select("review_data")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data?.review_data) {
        const rd = data.review_data as { parallel?: boolean; reviews?: ModelReview[] };
        if (rd.parallel && rd.reviews) {
          setReviews(rd.reviews);
          setSelectedTab(rd.reviews[0]?.model || null);
        } else {
          // Legacy single review
          setReviews([
            { model: "claude", label: "Claude Opus 4.6", data: rd as unknown as ReviewData },
          ]);
          setSelectedTab("claude");
        }
      }
    };
    load();
  }, [projectId]);

  const startParallelReview = useCallback(async () => {
    setGenerating(true);
    const supabase = createClient();

    const [briefResult, memoResult, structureResult] = await Promise.all([
      supabase
        .from("brief_sheets")
        .select("raw_markdown")
        .eq("project_id", projectId)
        .single(),
      supabase
        .from("research_memos")
        .select("raw_markdown")
        .eq("project_id", projectId)
        .single(),
      supabase
        .from("structures")
        .select("id, pages")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .single(),
    ]);

    let pageContents: unknown[] = [];
    if (structureResult.data) {
      const { data: contents } = await supabase
        .from("page_contents")
        .select("content")
        .eq("structure_id", structureResult.data.id)
        .order("page_number");
      pageContents =
        contents?.map((c) => c.content) ||
        structureResult.data.pages ||
        [];
    }

    try {
      const res = await fetch("/api/ai/review/parallel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          briefSheet: briefResult.data?.raw_markdown || "",
          researchMemo: memoResult.data?.raw_markdown || "",
          pageContents,
          deepMode,
        }),
      });

      if (res.ok) {
        const { reviews: newReviews } = await res.json();
        setReviews(newReviews);
        setSelectedTab(newReviews[0]?.model || null);
      }
    } catch {
      // Handle error silently
    } finally {
      setGenerating(false);
    }
  }, [projectId, deepMode]);

  const priorityColors: Record<string, string> = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-blue-100 text-blue-700",
  };

  const typeIcons: Record<string, string> = {
    improvement: "\u{1F4A1}",
    positive: "\u2705",
    warning: "\u26A0\uFE0F",
  };

  const modelColors: Record<string, string> = {
    claude: "border-amber-500",
    gemini: "border-blue-500",
    gpt: "border-emerald-500",
  };

  const modelBgColors: Record<string, string> = {
    claude: "bg-amber-500",
    gemini: "bg-blue-500",
    gpt: "bg-emerald-500",
  };

  const selectedReview = reviews.find((r) => r.model === selectedTab);

  // Score comparison
  const hasMultipleReviews = reviews.filter((r) => r.data).length > 1;

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy">
              マルチAIレビュー
            </h2>
            <p className="text-xs text-text-secondary">
              通常はGeminiのみ。Deep Modeで3モデル比較できます
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={deepMode}
                onChange={(e) => setDeepMode(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-beige text-green focus:ring-green"
              />
              Deep Mode
            </label>
            <button
              onClick={startParallelReview}
              disabled={generating}
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
            >
              {generating
                ? deepMode
                  ? "3モデルレビュー中..."
                  : "Geminiレビュー中..."
                : deepMode
                  ? "Deep Modeでレビュー開始"
                  : "Geminiでレビュー開始"}
            </button>
          </div>
        </div>

        {reviews.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-beige p-12 text-center">
            <p className="text-sm text-text-secondary">
              {deepMode
                ? "Claude / Gemini / GPT の3モデルでレビューします。"
                : "Gemini 1モデルで高速レビューします。"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              必要なときだけDeep Modeにして比較精査できます。
            </p>
          </div>
        ) : (
          <div>
            {/* Score comparison bar */}
            {hasMultipleReviews && (
              <div className="mb-6 grid grid-cols-3 gap-3">
                {reviews.map((r) => (
                  <button
                    key={r.model}
                    onClick={() => setSelectedTab(r.model)}
                    className={`rounded-lg border-2 bg-white p-4 text-left transition-all ${
                      selectedTab === r.model
                        ? modelColors[r.model] || "border-navy"
                        : "border-beige hover:border-beige/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ${
                          modelBgColors[r.model] || "bg-navy"
                        }`}
                      >
                        {r.data?.overall_score ?? "—"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-navy">
                          {r.label}
                        </p>
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
            )}

            {/* Category score comparison */}
            {hasMultipleReviews && (
              <div className="mb-6 rounded-lg border border-beige bg-white p-4">
                <h3 className="mb-3 text-sm font-bold text-navy">
                  カテゴリ別スコア比較
                </h3>
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
                          const score =
                            r.data?.categories[ci]?.score ?? 0;
                          return (
                            <div key={r.model} className="flex-1">
                              <div className="flex items-center gap-1.5">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      modelBgColors[r.model] || "bg-navy"
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
                  {/* Legend */}
                  <div className="mt-2 flex gap-4 border-t border-beige/50 pt-2">
                    {reviews.map((r) => (
                      <div key={r.model} className="flex items-center gap-1.5">
                        <div
                          className={`h-2.5 w-2.5 rounded-full ${
                            modelBgColors[r.model] || "bg-navy"
                          }`}
                        />
                        <span className="text-xs text-text-secondary">
                          {r.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Detailed review for selected model */}
            {selectedReview?.data && (
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      modelBgColors[selectedReview.model] || "bg-navy"
                    }`}
                  />
                  <h3 className="text-sm font-bold text-navy">
                    {selectedReview.label} の詳細レビュー
                  </h3>
                </div>

                <div className="space-y-4">
                  {selectedReview.data.categories.map((category, ci) => (
                    <div
                      key={ci}
                      className="rounded-lg border border-beige bg-white p-4"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <h3 className="text-sm font-bold text-navy flex-shrink-0">
                          {category.name}
                        </h3>
                        <div className="flex flex-1 items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={`h-full rounded-full transition-all ${
                                modelBgColors[selectedReview.model] || "bg-navy"
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
                        {category.items.map((item, ii) => (
                          <div
                            key={ii}
                            className="rounded border border-beige/50 bg-off-white p-3"
                          >
                            <div className="flex items-start gap-2">
                              <span>{typeIcons[item.type]}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  {item.target_page && (
                                    <span className="text-xs text-text-secondary">
                                      P{item.target_page}
                                    </span>
                                  )}
                                  {item.priority && (
                                    <span
                                      className={`rounded px-1.5 py-0.5 text-xs ${priorityColors[item.priority]}`}
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
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedReview?.error && !selectedReview.data && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-sm text-red-600">
                  {selectedReview.label}: {selectedReview.error}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
