"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildSingleSlideDocument } from "@/lib/slides/base-styles";
import { useProjectChat } from "../chat/use-project-chat";
import type { ApplyPayload } from "../chat/use-project-chat";

interface HtmlSlide {
  index: number;
  html: string;
  slideType: string;
  title: string;
}

export default function DesignPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [pageContents, setPageContents] = useState<Record<string, unknown>[]>(
    []
  );
  const [slides, setSlides] = useState<HtmlSlide[]>([]);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatRevisingSlide, setChatRevisingSlide] = useState<number | null>(null);

  // Load existing data on mount
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      // Load page contents from structures + page_contents
      const { data: structureData } = await supabase
        .from("structures")
        .select("id, pages")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (structureData) {
        const { data: contents } = await supabase
          .from("page_contents")
          .select("page_number, content")
          .eq("structure_id", structureData.id)
          .order("page_number");

        if (contents?.length) {
          setPageContents(
            contents.map((c) => c.content as Record<string, unknown>)
          );
        } else if (structureData.pages) {
          setPageContents(structureData.pages as Record<string, unknown>[]);
        }
      }

      // Check for existing generated file with HTML slides
      const { data: genFile } = await supabase
        .from("generated_files")
        .select("id, slide_data, storage_path, file_type")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (genFile?.slide_data) {
        const data = genFile.slide_data as {
          slides?: HtmlSlide[];
        };
        // Check if this is HTML format (has .html field)
        if (data.slides?.[0]?.html) {
          setSlides(data.slides);
        }
      }

      // 既存PDFがあればダウンロードURLを設定
      if (genFile?.id && genFile?.file_type === "pdf" && genFile?.storage_path) {
        setDownloadUrl(`/api/slides/pdf/download?id=${genFile.id}`);
      }
    };
    load();
  }, [projectId]);

  const { registerApplyHandler, summarizeCurrentStep } = useProjectChat();
  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  // Handle APPLY from chat (delegated slide revision)
  useEffect(() => {
    registerApplyHandler(async (payload: ApplyPayload) => {
      if (
        payload.action === "revise_slide" &&
        typeof payload.slideIndex === "number"
      ) {
        const slideIndex = payload.slideIndex as number;
        const instruction = payload.instruction as string;
        const currentSlide = slidesRef.current[slideIndex];
        if (!currentSlide || !instruction) return;

        setChatRevisingSlide(slideIndex);
        try {
          const res = await fetch("/api/ai/design/revise", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectId,
              slideIndex,
              instruction,
              currentSlide,
            }),
          });
          const data = await res.json();
          if (res.ok && data.revisedSlide) {
            setSlides((prev) =>
              prev.map((s, i) => (i === slideIndex ? data.revisedSlide : s))
            );
            setDownloadUrl(null);
          }
        } catch (err) {
          console.error("[design] Chat revision failed:", err);
        } finally {
          setChatRevisingSlide(null);
        }
      }
    });
  }, [registerApplyHandler, projectId]);

  // Generate HTML slides
  const generateSlides = async () => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, pageContents }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.slides) {
        setSlides(data.slides);
        setDownloadUrl(null); // Clear old PDF URL since slides changed
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  // Download PDF
  const downloadPdf = async () => {
    setDownloadingPdf(true);
    setError(null);

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
        // Open download in new tab
        window.open(data.downloadUrl, "_blank");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "PDF生成に失敗しました"
      );
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Complete design and move to review
  const completeDesign = async () => {
    await summarizeCurrentStep();
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ current_step: 6 })
      .eq("id", projectId);
    router.push(`/projects/${projectId}/design-review`);
  };

  // Memoize iframe srcDoc for each slide
  const slideSrcDocs = useMemo(
    () => slides.map((s) => buildSingleSlideDocument(s.html)),
    [slides]
  );

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy">デザイン化 & PDF生成</h2>
            <p className="text-xs text-text-secondary">
              AIがHTMLスライドを生成し、PDFでダウンロードできます
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={generateSlides}
              disabled={generating || pageContents.length === 0}
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
            >
              {generating
                ? `スライド生成中...`
                : slides.length > 0
                  ? "スライドを再生成"
                  : "HTMLスライドを生成"}
            </button>
            {slides.length > 0 && (
              <button
                onClick={downloadPdf}
                disabled={downloadingPdf}
                className="rounded-md border border-navy bg-white px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-navy/5 disabled:opacity-50"
              >
                {downloadingPdf ? "PDF変換中..." : "PDFをダウンロード"}
              </button>
            )}
            <button
              onClick={completeDesign}
              disabled={slides.length === 0}
              className="rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90 disabled:opacity-50"
            >
              デザイン完了 → 最終レビューへ
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Download link */}
        {downloadUrl && (
          <div className="mb-6 rounded-lg border border-green bg-green/5 p-4">
            <p className="mb-2 text-sm font-medium text-green">
              PDFファイルが生成されました
            </p>
            <a
              href={downloadUrl}
              download
              className="inline-block rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90"
            >
              ダウンロード (.pdf)
            </a>
          </div>
        )}

        {/* Empty state */}
        {slides.length === 0 && !generating && (
          <div className="rounded-lg border-2 border-dashed border-beige p-12 text-center">
            <p className="text-sm text-text-secondary">
              {pageContents.length > 0
                ? "「HTMLスライドを生成」ボタンでAIがスライドをデザインします"
                : "ページコンテンツがまだ生成されていません。先に「詳細作成」を完了してください。"}
            </p>
          </div>
        )}

        {/* Generating state */}
        {generating && (
          <div className="flex items-center justify-center rounded-lg border border-beige bg-white p-12">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-navy border-t-transparent" />
              <p className="text-sm text-navy">
                AIが{pageContents.length}ページ分のスライドをデザイン中...
              </p>
            </div>
          </div>
        )}

        {/* Slide preview grid */}
        {slides.length > 0 && !generating && (
          <div className="grid gap-4 md:grid-cols-2">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`rounded-lg border bg-white transition-all ${
                  chatRevisingSlide === index
                    ? "border-navy/30 opacity-70"
                    : "border-beige"
                }`}
              >
                {/* Slide header */}
                <div className="flex items-center gap-2 border-b border-beige/50 px-3 py-2">
                  <span className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-medium text-navy">
                    {slide.slideType}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {index + 1} / {slides.length}
                  </span>
                </div>

                {/* Slide iframe preview (16:9) */}
                <div className="relative aspect-[16/9] overflow-hidden bg-gray-50">
                  <iframe
                    srcDoc={slideSrcDocs[index]}
                    title={slide.title}
                    sandbox="allow-same-origin"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      width: "960px",
                      height: "540px",
                      transform: "scale(var(--scale))",
                      transformOrigin: "top left",
                      border: "none",
                      // --scale is computed based on container width
                      // For md:grid-cols-2, container is ~50% of max-w-6xl (1152px)
                      // So each card is ~560px → scale = 560/960 ≈ 0.583
                    }}
                    ref={(el) => {
                      if (el) {
                        const parent = el.parentElement;
                        if (parent) {
                          const observer = new ResizeObserver(() => {
                            const scale = parent.clientWidth / 960;
                            el.style.setProperty("--scale", String(scale));
                            el.style.transform = `scale(${scale})`;
                            // Also set height to match
                            parent.style.height = `${540 * scale}px`;
                          });
                          observer.observe(parent);
                        }
                      }
                    }}
                  />
                </div>

                {/* Slide title */}
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-navy truncate">
                    {slide.title}
                  </p>
                </div>

                {/* Loading overlay for chat revision */}
                {chatRevisingSlide === index && (
                  <div className="px-3 pb-3 flex items-center gap-2 text-xs text-navy">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-navy border-t-transparent" />
                    AIがスライドを修正中...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
