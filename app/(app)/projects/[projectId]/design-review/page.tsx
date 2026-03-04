"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildSingleSlideDocument } from "@/lib/slides/base-styles";
import type { HtmlSlide, HtmlPresentation } from "@/lib/slides/types";
import { useAbortableAction } from "@/hooks/use-abortable-action";
import { ResultView } from "./components/result-view";
import type { ItemDecision, ModelReview, ReviewItem } from "./types";
import { ReviewScoreComparison } from "./components/review-score-comparison";
import { ReviewDetailSection } from "./components/review-detail-section";
import { useProjectChat } from "../chat/use-project-chat";

export default function DesignReviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const { runWithTimeout } = useAbortableAction();
  const { summarizeCurrentStep } = useProjectChat();
  const [reviews, setReviews] = useState<ModelReview[]>([]);
  const [generating, setGenerating] = useState(false);
  const [deepMode, setDeepMode] = useState(false);
  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [itemDecisions, setItemDecisions] = useState<
    Map<string, ItemDecision>
  >(new Map());

  // Feature 5: apply-feedback state
  const [applyingFeedback, setApplyingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [beforeSlides, setBeforeSlides] = useState<HtmlSlide[]>([]);
  const [afterSlides, setAfterSlides] = useState<HtmlSlide[]>([]);
  const [appliedItems, setAppliedItems] = useState<ReviewItem[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [compareIndex, setCompareIndex] = useState(0);

  // PDF download state
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Color overrides for preview
  const [colorOverrides, setColorOverrides] = useState<
    HtmlPresentation["colorOverrides"]
  >(undefined);

  // Load existing design review + color overrides
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [reviewResult, genFileResult] = await Promise.all([
        supabase
          .from("reviews")
          .select("review_data")
          .eq("project_id", projectId)
          .eq("review_type", "design")
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from("generated_files")
          .select("slide_data")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      ]);

      if (reviewResult.data?.review_data) {
        const rd = reviewResult.data.review_data as {
          parallel?: boolean;
          reviews?: ModelReview[];
        };
        if (rd.parallel && rd.reviews) {
          setReviews(rd.reviews);
          setSelectedTab(rd.reviews[0]?.model || null);
        }
      }

      // Get color overrides from slide data
      if (genFileResult.data?.slide_data) {
        const pres = genFileResult.data
          .slide_data as unknown as HtmlPresentation;
        if (pres.colorOverrides) {
          setColorOverrides(pres.colorOverrides);
        }
      }
    };
    load();
  }, [projectId]);

  const startDesignReview = useCallback(async () => {
    setGenerating(true);
    const supabase = createClient();

    const [briefResult, genFileResult] = await Promise.all([
      supabase
        .from("brief_sheets")
        .select("raw_markdown")
        .eq("project_id", projectId)
        .single(),
      supabase
        .from("generated_files")
        .select("slide_data")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

    const slideData = genFileResult.data?.slide_data as {
      slides?: Array<{ html?: string; title?: string; slideType?: string }>;
    } | null;

    const pageContents =
      slideData?.slides?.map((s) => ({
        title: s.title || "",
        slideType: s.slideType || "",
        html: s.html || "",
      })) || [];

    try {
      const res = await runWithTimeout(
        (signal) =>
          fetch("/api/ai/design-review/parallel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              briefSheet: briefResult.data?.raw_markdown || "",
              pageContents,
              deepMode,
            }),
            signal,
          }),
        310_000
      );

      if (res.ok) {
        const { reviews: newReviews } = await res.json();
        setReviews(newReviews);
        setSelectedTab(newReviews[0]?.model || null);
        setItemDecisions(new Map());
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setFeedbackError(
          "レビューがタイムアウトしました。もう一度お試しください。"
        );
      }
    } finally {
      setGenerating(false);
    }
  }, [projectId, runWithTimeout, deepMode]);

  // 3-state decision helpers
  const setDecision = (itemKey: string, decision: ItemDecision) => {
    setItemDecisions((prev) => {
      const next = new Map(prev);
      if (decision === "pending") {
        next.delete(itemKey);
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
  const adoptedCount = Array.from(itemDecisions.values()).filter(
    (d) => d === "adopted"
  ).length;
  const rejectedCount = Array.from(itemDecisions.values()).filter(
    (d) => d === "rejected"
  ).length;
  const totalImprovements = reviews.reduce((sum, r) => {
    if (!r.data) return sum;
    return (
      sum +
      r.data.categories.reduce(
        (s, c) => s + c.items.filter((i) => i.type === "improvement").length,
        0
      )
    );
  }, 0);
  const pendingCount = totalImprovements - adoptedCount - rejectedCount;

  // Feature 5: Apply design feedback
  const applyFeedback = async () => {
    const items = getAdoptedReviewItems();
    if (items.length === 0) return;

    setApplyingFeedback(true);
    setFeedbackError(null);

    try {
      const res = await runWithTimeout(
        (signal) =>
          fetch("/api/ai/design/apply-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              adoptedItems: items,
            }),
            signal,
          }),
        310_000
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error || `反映に失敗しました（ステータス: ${res.status}）`
        );
      }

      const data = await res.json();
      setBeforeSlides(data.beforeSlides as HtmlSlide[]);
      setAfterSlides(data.afterSlides as HtmlSlide[]);
      setAppliedItems(items);
      setCompareIndex(0);
      setShowResult(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setFeedbackError(
          "反映がタイムアウトしました。もう一度お試しください。"
        );
      } else {
        setFeedbackError(
          err instanceof Error
            ? err.message
            : "フィードバックの反映に失敗しました"
        );
      }
    } finally {
      setApplyingFeedback(false);
    }
  };

  // Download PDF
  const downloadPdf = async () => {
    setDownloadingPdf(true);
    setFeedbackError(null);

    try {
      const res = await fetch("/api/slides/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
        window.open(data.downloadUrl, "_blank");
      }
    } catch (err) {
      setFeedbackError(
        err instanceof Error ? err.message : "PDF生成に失敗しました"
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Complete design review
  const completeDesignReview = async () => {
    await summarizeCurrentStep();
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ current_step: 7 })
      .eq("id", projectId);

    router.push(`/dashboard`);
  };

  // Reset reviews and re-run
  const reRunReview = async () => {
    setReviews([]);
    setSelectedTab(null);
    setItemDecisions(new Map());
    setShowResult(false);
    setBeforeSlides([]);
    setAfterSlides([]);
    await startDesignReview();
  };

  const selectedReview = reviews.find((r) => r.model === selectedTab);
  const hasMultipleReviews = reviews.filter((r) => r.data).length > 1;

  // Build iframe srcDoc for before/after preview
  const buildPreviewDoc = useMemo(() => {
    return (slide: HtmlSlide | undefined) => {
      if (!slide) return "";
      return buildSingleSlideDocument(slide.html, colorOverrides);
    };
  }, [colorOverrides]);

  // Before/After comparison view
  if (showResult && afterSlides.length > 0) {
    return (
      <ResultView
        appliedItems={appliedItems}
        beforeSlides={beforeSlides}
        afterSlides={afterSlides}
        compareIndex={compareIndex}
        setCompareIndex={setCompareIndex}
        downloadUrl={downloadUrl}
        downloadingPdf={downloadingPdf}
        onBackToReview={() => setShowResult(false)}
        onReRunReview={reRunReview}
        onBackToDesign={() => router.push(`/projects/${projectId}/design`)}
        onDownloadPdf={downloadPdf}
        onComplete={completeDesignReview}
        buildPreviewDoc={buildPreviewDoc}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy">最終レビュー</h2>
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
              onClick={startDesignReview}
              disabled={generating}
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
            >
              {generating
                ? deepMode
                  ? "3モデルレビュー中..."
                  : "Geminiレビュー中..."
                : deepMode
                  ? "Deep Modeで最終レビュー開始"
                  : "Geminiで最終レビュー開始"}
            </button>
            {reviews.length > 0 && (
              <>
                <button
                  onClick={downloadPdf}
                  disabled={downloadingPdf}
                  className="rounded-md border border-navy bg-white px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-navy/5 disabled:opacity-50"
                >
                  {downloadingPdf ? "PDF変換中..." : "PDFをダウンロード"}
                </button>
                <button
                  onClick={() =>
                    router.push(`/projects/${projectId}/design`)
                  }
                  className="rounded-md border border-beige bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-off-white"
                >
                  デザインに戻る
                </button>
                <button
                  onClick={completeDesignReview}
                  className="rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90"
                >
                  デザイン完了
                </button>
              </>
            )}
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
                  : "採用した指摘をデザインに反映"}
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
                ? "Claude / Gemini / GPT の3モデルでデザインレビューします。"
                : "Gemini 1モデルで高速にデザインレビューします。"}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              必要時のみDeep Modeにして比較精査できます。
            </p>
          </div>
        ) : (
          <div>
            {/* Score comparison bar */}
            {hasMultipleReviews && (
              <ReviewScoreComparison
                reviews={reviews}
                selectedTab={selectedTab}
                onSelectTab={setSelectedTab}
              />
            )}

            {/* Detailed review for selected model */}
            {selectedReview?.data && (
              <ReviewDetailSection
                selectedReview={
                  selectedReview as ModelReview & {
                    data: NonNullable<ModelReview["data"]>;
                  }
                }
                getDecision={getDecision}
                onSetDecision={setDecision}
              />
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
