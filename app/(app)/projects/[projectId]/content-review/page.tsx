"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ReviewItem {
  type: "improvement" | "positive" | "warning";
  target_page?: number;
  description: string;
  suggestion?: string;
  priority?: "high" | "medium" | "low";
  reason?: string;
  risk?: string;
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

interface PageContent {
  page_number: number;
  title?: string;
  body?: string;
  bullets?: Array<{ text: string }>;
  kpis?: Array<{ value: string; label: string }>;
  [key: string]: unknown;
}

type ItemDecision = "adopted" | "rejected" | "pending";

export default function ContentReviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [reviews, setReviews] = useState<ModelReview[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [deepMode, setDeepMode] = useState(false);
  const [itemDecisions, setItemDecisions] = useState<Map<string, ItemDecision>>(new Map());
  const [applyingFeedback, setApplyingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  // Before/after comparison state
  const [beforePages, setBeforePages] = useState<PageContent[]>([]);
  const [afterPages, setAfterPages] = useState<PageContent[]>([]);
  const [appliedItems, setAppliedItems] = useState<ReviewItem[]>([]);
  const [showResult, setShowResult] = useState(false);

  // Load existing content review + current page contents (for before/after comparison)
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [reviewResult, structureResult] = await Promise.all([
        supabase
          .from("reviews")
          .select("review_data")
          .eq("project_id", projectId)
          .eq("review_type", "content")
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("structures")
          .select("id")
          .eq("project_id", projectId)
          .order("version", { ascending: false })
          .limit(1)
          .single(),
      ]);

      if (reviewResult.data?.review_data) {
        const rd = reviewResult.data.review_data as { parallel?: boolean; reviews?: ModelReview[] };
        if (rd.parallel && rd.reviews) {
          setReviews(rd.reviews);
          setSelectedTab(rd.reviews[0]?.model || null);
        }
      }

      // Load current page contents as "before" snapshot
      if (structureResult.data?.id) {
        const { data: contents } = await supabase
          .from("page_contents")
          .select("page_number, content")
          .eq("structure_id", structureResult.data.id)
          .order("page_number");

        if (contents?.length) {
          setBeforePages(
            contents.map((c) => c.content as PageContent)
          );
        }
      }
    };
    load();
  }, [projectId]);

  const startContentReview = useCallback(async () => {
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
      const res = await fetch("/api/ai/content-review/parallel", {
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
        setItemDecisions(new Map());
      }
    } catch {
      // Handle error silently
    } finally {
      setGenerating(false);
    }
  }, [projectId, deepMode]);

  const setDecision = (itemKey: string, decision: ItemDecision) => {
    setItemDecisions((prev) => {
      const next = new Map(prev);
      if (decision === "pending") {
        next.delete(itemKey); // pending = default (not in map)
      } else {
        next.set(itemKey, decision);
      }
      return next;
    });
  };

  const getDecision = (itemKey: string): ItemDecision => {
    return itemDecisions.get(itemKey) || "pending";
  };

  // Collect all adopted items across all models
  const getAdoptedReviewItems = (): ReviewItem[] => {
    const items: ReviewItem[] = [];
    for (const review of reviews) {
      if (!review.data) continue;
      for (const cat of review.data.categories) {
        for (const item of cat.items) {
          const key = `${review.model}-${cat.name}-${item.description}`;
          if (itemDecisions.get(key) === "adopted") {
            items.push(item);
          }
        }
      }
    }
    return items;
  };

  // Decision counts
  const adoptedCount = Array.from(itemDecisions.values()).filter((d) => d === "adopted").length;
  const rejectedCount = Array.from(itemDecisions.values()).filter((d) => d === "rejected").length;
  const totalImprovements = reviews.reduce((sum, r) => {
    if (!r.data) return sum;
    return sum + r.data.categories.reduce((s, c) =>
      s + c.items.filter((i) => i.type === "improvement").length, 0);
  }, 0);
  const pendingCount = totalImprovements - adoptedCount - rejectedCount;

  const applyFeedback = async () => {
    const items = getAdoptedReviewItems();
    if (items.length === 0) return;

    setApplyingFeedback(true);
    setFeedbackError(null);

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 310_000);

    try {
      const res = await fetch("/api/ai/details/apply-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          adoptedItems: items,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || `反映に失敗しました（ステータス: ${res.status}）`
        );
      }

      const data = await res.json();
      // Show before/after comparison instead of navigating immediately
      setAfterPages(data.pages as PageContent[]);
      setAppliedItems(items);
      setShowResult(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setFeedbackError("反映がタイムアウトしました。もう一度お試しください。");
      } else {
        setFeedbackError(
          err instanceof Error ? err.message : "フィードバックの反映に失敗しました"
        );
      }
    } finally {
      clearTimeout(timeout);
      setApplyingFeedback(false);
    }
  };

  const completeContentReview = async () => {
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ current_step: 5 })
      .eq("id", projectId);

    router.push(`/projects/${projectId}/design`);
  };

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
  const hasMultipleReviews = reviews.filter((r) => r.data).length > 1;

  // Helper: get text summary for a page (title + body excerpt)
  const getPageSummary = (page: PageContent): string => {
    const parts: string[] = [];
    if (page.body) parts.push(page.body);
    if (page.bullets?.length) {
      parts.push(page.bullets.map((b) => `・${b.text}`).join("\n"));
    }
    if (page.kpis?.length) {
      parts.push(page.kpis.map((k) => `${k.value} ${k.label}`).join("、"));
    }
    return parts.join("\n") || "（内容なし）";
  };

  // Before/After comparison view
  if (showResult && afterPages.length > 0) {
    // Find pages that were affected by feedback
    const affectedPageNumbers = new Set(
      appliedItems
        .filter((item) => item.target_page)
        .map((item) => item.target_page!)
    );

    // If no target_page specified, all pages may have changed
    const changedPages = afterPages.filter((afterPage) => {
      if (affectedPageNumbers.size === 0) return true; // show all if no target specified
      return affectedPageNumbers.has(afterPage.page_number);
    });

    return (
      <div className="p-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-navy">反映結果</h2>
              <p className="text-xs text-text-secondary">
                {appliedItems.length}件の指摘を反映しました
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResult(false)}
                className="rounded-md border border-beige bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-off-white"
              >
                レビューに戻る
              </button>
              <button
                onClick={() => router.push(`/projects/${projectId}/details`)}
                className="rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90"
              >
                詳細ページで全文を確認
              </button>
            </div>
          </div>

          {/* Applied items summary */}
          <div className="mb-6 rounded-lg border border-green bg-green/5 p-4">
            <h3 className="mb-2 text-sm font-bold text-green">採用した指摘</h3>
            <ul className="space-y-1">
              {appliedItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-text-primary">
                  <span className="text-green">✓</span>
                  <span>
                    {item.target_page && (
                      <span className="mr-1 rounded bg-navy/10 px-1 py-0.5 text-navy">
                        P{item.target_page}
                      </span>
                    )}
                    {item.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Before/After comparison for each changed page */}
          <div className="space-y-4">
            {changedPages.map((afterPage) => {
              const beforePage = beforePages.find(
                (p) => p.page_number === afterPage.page_number
              );
              const beforeText = beforePage ? getPageSummary(beforePage) : "（データなし）";
              const afterText = getPageSummary(afterPage);
              const hasChange = beforeText !== afterText;

              return (
                <div
                  key={afterPage.page_number}
                  className="rounded-lg border border-beige bg-white overflow-hidden"
                >
                  <div className="flex items-center gap-2 border-b border-beige bg-off-white px-4 py-2">
                    <span className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-medium text-navy">
                      P{afterPage.page_number}
                    </span>
                    <span className="text-sm font-medium text-navy">
                      {afterPage.title}
                    </span>
                    {hasChange ? (
                      <span className="ml-auto rounded bg-green/10 px-2 py-0.5 text-xs font-medium text-green">
                        変更あり
                      </span>
                    ) : (
                      <span className="ml-auto rounded bg-beige/50 px-2 py-0.5 text-xs text-text-secondary">
                        変更なし
                      </span>
                    )}
                  </div>

                  {hasChange && (
                    <div className="grid grid-cols-2 divide-x divide-beige">
                      {/* Before */}
                      <div className="p-4">
                        <p className="mb-2 text-xs font-bold text-red-400">変更前</p>
                        <p className="whitespace-pre-wrap text-xs text-text-secondary leading-relaxed">
                          {beforeText}
                        </p>
                      </div>
                      {/* After */}
                      <div className="p-4">
                        <p className="mb-2 text-xs font-bold text-green">変更後</p>
                        <p className="whitespace-pre-wrap text-xs text-text-primary leading-relaxed">
                          {afterText}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy">内容レビュー</h2>
            <p className="text-xs text-text-secondary">
              通常はGeminiのみ。Deep Modeで3モデル比較できます
            </p>
          </div>
          <div className="flex gap-2">
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
              onClick={startContentReview}
              disabled={generating}
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
            >
              {generating
                ? deepMode
                  ? "3モデルレビュー中..."
                  : "Geminiレビュー中..."
                : deepMode
                  ? "Deep Modeで内容レビュー開始"
                  : "Geminiで内容レビュー開始"}
            </button>
            <button
              onClick={completeContentReview}
              disabled={reviews.length === 0}
              className="rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90 disabled:opacity-50"
            >
              レビュー完了 → デザイン化へ
            </button>
          </div>
        </div>

        {/* Feedback action bar with decision counts */}
        {totalImprovements > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-beige bg-white p-3">
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="text-green">{adoptedCount}件 採用</span>
              <span className="text-gray-500">{rejectedCount}件 不採用</span>
              <span className="text-yellow-500">{pendingCount}件 保留</span>
            </div>
            {adoptedCount > 0 && (
              <button
                onClick={applyFeedback}
                disabled={applyingFeedback}
                className="rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90 disabled:opacity-50"
              >
                {applyingFeedback
                  ? "フィードバック反映中..."
                  : "採用した指摘を詳細に反映"}
              </button>
            )}
          </div>
        )}

        {feedbackError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {feedbackError}
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-beige p-12 text-center">
            <p className="text-sm text-text-secondary">
              {deepMode
                ? "Claude / Gemini / GPT の3モデルで内容レビューします。"
                : "Gemini 1モデルで高速に内容レビューします。"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              必要時のみDeep Modeにして比較精査できます。
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
                                  {/* reason / risk 表示 */}
                                  {(item.reason || item.risk) && (
                                    <div className="mt-2 space-y-1 rounded border border-beige/50 bg-off-white p-2">
                                      {item.reason && (
                                        <p className="text-xs text-text-secondary">
                                          <span className="font-medium text-navy">重要な理由：</span>{item.reason}
                                        </p>
                                      )}
                                      {item.risk && (
                                        <p className="text-xs text-text-secondary">
                                          <span className="font-medium text-red-600">見送りのリスク：</span>{item.risk}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {/* 3-state decision buttons for improvement items */}
                                {isImprovement && (
                                  <div className="flex flex-shrink-0 gap-1">
                                    <button
                                      onClick={() => setDecision(itemKey, "adopted")}
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
                                      onClick={() => setDecision(itemKey, "rejected")}
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
                                      onClick={() => setDecision(itemKey, "pending")}
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
