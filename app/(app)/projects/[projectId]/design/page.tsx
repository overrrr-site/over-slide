"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buildSingleSlideDocument } from "@/lib/slides/base-styles";
import type { DocumentData, DocxSection, DocxTableData } from "@/lib/docx/types";

interface HtmlSlide {
  index: number;
  html: string;
  slideType: string;
  title: string;
}

/** pageContents（スライド/ドキュメント用ページデータ）から DocumentData を構築する */
function buildDocumentData(
  pages: Record<string, unknown>[],
  projectTitle: string,
  clientName?: string,
  outputType?: "slide" | "document"
): DocumentData {
  let docTitle = projectTitle;
  let docSubtitle: string | undefined;
  const sections: DocxSection[] = [];

  for (const page of pages) {
    const masterType = (page.master_type as string) || "CONTENT_1COL";
    const title = (page.title as string) || "";

    switch (masterType) {
      case "COVER": {
        // 表紙 → ドキュメントのタイトル/サブタイトルに使う
        if (title) docTitle = title;
        const subtitle = page.subtitle as string | undefined;
        const body = page.body as string | undefined;
        if (subtitle) {
          docSubtitle = subtitle;
        } else if (body) {
          // body の先頭行をサブタイトルに
          docSubtitle = body.split("\n")[0];
        }
        if (clientName) {
          docSubtitle = docSubtitle
            ? `${docSubtitle}\n${clientName}`
            : clientName;
        }
        // 表紙の残りの情報（提出日等）があればセクションとして出力
        if (body) {
          const lines = body.split("\n").filter((l: string) => l.trim());
          // サブタイトルに使った先頭行を除いた残り
          const remaining = subtitle ? lines : lines.slice(1);
          if (remaining.length > 0) {
            sections.push({
              level: 2,
              title: "",
              body: remaining.join("\n"),
            });
          }
        }
        break;
      }

      case "SECTION": {
        // スライド用: セクション区切り → 章見出し (level 1)
        // 文書用: 節見出し (level 2) — CHAPTER(H1) → SECTION(H2) の階層を守る
        const sectionLevel = outputType === "document" ? 2 : 1;
        const sectionObj: DocxSection = {
          level: sectionLevel as 1 | 2 | 3,
          title,
        };
        const sBody = page.body as string | string[] | undefined;
        const sBullets = page.bullets as
          | string[]
          | Array<{ text: string }>
          | undefined;
        const sTable = page.table as
          | { headers: string[]; rows: string[][] }
          | undefined;

        if (sBody) {
          sectionObj.body = sBody;
        }
        if (sBullets && sBullets.length > 0) {
          if (sBody) {
            sectionObj.bullets = normalizeBullets(sBullets);
          } else {
            sectionObj.body = normalizeBullets(sBullets);
          }
        }
        if (sTable) {
          sectionObj.table = sTable as DocxTableData;
        }
        sections.push(sectionObj);
        break;
      }

      case "CHAPTER": {
        // 文書用: 章見出し (level 1) + 導入文
        const section: DocxSection = { level: 1, title };
        const body = page.body as string | undefined;
        if (body) section.body = body;
        sections.push(section);
        break;
      }

      case "SUBSECTION": {
        // 文書用: 項見出し (level 3) + 本文 + 箇条書き
        const section: DocxSection = { level: 3, title };
        const body = page.body as string | string[] | undefined;
        const bullets = page.bullets as
          | string[]
          | Array<{ text: string }>
          | undefined;
        const table = page.table as
          | { headers: string[]; rows: string[][] }
          | undefined;

        if (body) {
          section.body = body;
        }
        if (bullets && bullets.length > 0) {
          if (body) {
            section.bullets = normalizeBullets(bullets);
          } else {
            section.body = normalizeBullets(bullets);
          }
        }
        if (table) {
          section.table = table as DocxTableData;
        }
        sections.push(section);
        break;
      }

      case "CONTENT_1COL": {
        // 1カラム → 節見出し (level 2) + 本文 + 箇条書き
        const section: DocxSection = { level: 2, title };
        const body = page.body as string | string[] | undefined;
        const bullets = page.bullets as
          | string[]
          | Array<{ text: string }>
          | undefined;
        const table = page.table as
          | { headers: string[]; rows: string[][] }
          | undefined;

        if (body) {
          section.body = body;
        }
        // 箇条書きは本文と併存できる（本文で説明→箇条書きで要点整理）
        if (bullets && bullets.length > 0) {
          if (body) {
            section.bullets = normalizeBullets(bullets);
          } else {
            section.body = normalizeBullets(bullets);
          }
        }
        if (table) {
          section.table = table as DocxTableData;
        }
        sections.push(section);
        break;
      }

      case "CONTENT_2COL": {
        // 2カラム → 節見出し (level 2) + 左右の内容を構造化して出力
        const section: DocxSection = { level: 2, title };
        const bodyLeft = page.bodyLeft as string | undefined;
        const bodyRight = page.bodyRight as string | undefined;
        const titleLeft = page.titleLeft as string | undefined;
        const titleRight = page.titleRight as string | undefined;
        const table = page.table as
          | { headers: string[]; rows: string[][] }
          | undefined;
        const bodyStr = page.body as string | undefined;

        if (table) {
          section.table = table as DocxTableData;
        } else if (bodyLeft && bodyRight) {
          // bodyLeft/bodyRight フィールドがある場合 → 2列の表
          const leftLines = bodyLeft
            .split("\n")
            .filter((l: string) => l.trim());
          const rightLines = bodyRight
            .split("\n")
            .filter((l: string) => l.trim());
          const maxRows = Math.max(leftLines.length, rightLines.length);
          const rows: string[][] = [];
          for (let r = 0; r < maxRows; r++) {
            rows.push([leftLines[r] || "", rightLines[r] || ""]);
          }
          section.table = {
            headers: [titleLeft || "左", titleRight || "右"],
            rows,
          };
        } else if (
          bodyStr &&
          bodyStr.includes("左カラム") &&
          bodyStr.includes("右カラム")
        ) {
          // body に「左カラム:」「右カラム:」が埋め込まれている場合
          const parsed = parseTwoColumnBody(bodyStr);
          if (parsed.leftTitle || parsed.rightTitle) {
            // タイトルがある → 子セクション (H3) として構造化
            section.children = [];
            if (parsed.leftTitle) {
              section.children.push({
                level: 3,
                title: parsed.leftTitle,
                body: parsed.leftBody,
              });
            }
            if (parsed.rightTitle) {
              section.children.push({
                level: 3,
                title: parsed.rightTitle,
                body: parsed.rightBody,
              });
            }
          } else {
            // タイトルなし → マーカーを除去して通常テキストとして出力
            const parts: string[] = [];
            if (parsed.leftBody) parts.push(parsed.leftBody);
            if (parsed.rightBody) parts.push(parsed.rightBody);
            if (parts.length > 0) section.body = parts.join("\n\n");
          }
        } else {
          // フォールバック: 利用可能なテキストをそのまま出力
          const parts: string[] = [];
          if (bodyLeft) parts.push(bodyLeft);
          if (bodyRight) parts.push(bodyRight);
          if (bodyStr) parts.push(bodyStr);
          if (parts.length > 0) section.body = parts.join("\n\n");
        }
        sections.push(section);
        break;
      }

      case "DATA_HIGHLIGHT": {
        // KPIデータ → 節見出し (level 2) + KPIを表に変換
        const section: DocxSection = { level: 2, title };
        const body = page.body as string | undefined;
        if (body) section.body = body;
        const kpis = page.kpis as
          | Array<{ value: string; label: string; description?: string }>
          | undefined;
        if (kpis && kpis.length > 0) {
          section.table = {
            headers: ["指標", "数値", "説明"],
            rows: kpis.map((k) => [
              k.label || "",
              k.value || "",
              k.description || "",
            ]),
          };
        }
        sections.push(section);
        break;
      }

      case "CONTENT_VISUAL": {
        // ビジュアル → 節見出し (level 2) + 本文 + 箇条書き
        const section: DocxSection = { level: 2, title };
        const body = page.body as string | undefined;
        const bullets = page.bullets as
          | string[]
          | Array<{ text: string }>
          | undefined;
        if (body) {
          section.body = body;
        }
        if (bullets && bullets.length > 0) {
          if (body) {
            section.bullets = normalizeBullets(bullets);
          } else {
            section.body = normalizeBullets(bullets);
          }
        }
        sections.push(section);
        break;
      }

      case "CLOSING": {
        // 最終ページ → 章見出し (level 1) + 本文
        sections.push({
          level: 1,
          title,
          body: page.body as string | undefined,
        });
        break;
      }

      default: {
        // 未知のタイプはlevel 2として処理
        const section: DocxSection = { level: 2, title };
        const body = page.body as string | undefined;
        if (body) section.body = body;
        sections.push(section);
        break;
      }
    }
  }

  return { title: docTitle, subtitle: docSubtitle, sections };
}

/** bullets の配列を string[] に正規化する */
function normalizeBullets(
  bullets: string[] | Array<{ text: string }>
): string[] {
  return bullets.map((b) => (typeof b === "string" ? b : b.text));
}

/**
 * CONTENT_2COL の body に埋め込まれた「左カラム:」「右カラム:」を解析する。
 * bodyLeft/bodyRight フィールドがない場合のフォールバック。
 */
function parseTwoColumnBody(body: string): {
  leftTitle?: string;
  leftBody?: string;
  rightTitle?: string;
  rightBody?: string;
} {
  const rightIdx = body.indexOf("右カラム");
  if (rightIdx === -1) return { leftBody: body };

  let leftRaw = body.substring(0, rightIdx);
  let rightRaw = body.substring(rightIdx);

  // 「左カラム:」「右カラム:」プレフィックスを除去
  leftRaw = leftRaw.replace(/^左カラム[:：]\s*/, "").trim();
  rightRaw = rightRaw.replace(/^右カラム[:：]\s*/, "").trim();

  // 埋め込みタイトルの検出（短い先頭行でピリオドなし → タイトルとみなす）
  const extractTitle = (
    text: string
  ): { title?: string; body: string } => {
    const lines = text.split("\n");
    const firstLine = lines[0]?.trim() || "";
    if (
      firstLine.length > 0 &&
      firstLine.length < 30 &&
      !firstLine.endsWith("。") &&
      !firstLine.endsWith("す") &&
      lines.length > 1
    ) {
      const rest = lines.slice(1).join("\n").trim();
      return { title: firstLine, body: rest };
    }
    return { body: text };
  };

  const left = extractTitle(leftRaw);
  const right = extractTitle(rightRaw);

  return {
    leftTitle: left.title,
    leftBody: left.body,
    rightTitle: right.title,
    rightBody: right.body,
  };
}

export default function DesignPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [outputType, setOutputType] = useState<"slide" | "document">("slide");
  const [projectTitle, setProjectTitle] = useState("");
  const [clientName, setClientName] = useState<string | undefined>();
  const [pageContents, setPageContents] = useState<Record<string, unknown>[]>(
    []
  );
  const [slides, setSlides] = useState<HtmlSlide[]>([]);
  const [generating, setGenerating] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingSlide, setEditingSlide] = useState<number | null>(null);
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [revisingSlide, setRevisingSlide] = useState<number | null>(null);

  // Load existing data on mount
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      // Load project info
      const { data: projectData } = await supabase
        .from("projects")
        .select("title, client_name, output_type")
        .eq("id", projectId)
        .single();
      if (projectData) {
        if (projectData.output_type) {
          setOutputType(projectData.output_type as "slide" | "document");
        }
        if (projectData.title) setProjectTitle(projectData.title);
        if (projectData.client_name) setClientName(projectData.client_name);
      }

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

      // 既存ファイルがあればダウンロードURLを設定（localhost プロキシ経由）
      if (genFile?.id && genFile?.storage_path) {
        setDownloadUrl(`/api/docx/download?id=${genFile.id}`);
      }
    };
    load();
  }, [projectId]);

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

  // Revise a single slide
  const reviseSlide = useCallback(
    async (slideIndex: number) => {
      if (!revisionInstruction.trim()) return;
      const currentSlide = slides[slideIndex];
      if (!currentSlide) return;

      setRevisingSlide(slideIndex);
      setError(null);

      try {
        const res = await fetch("/api/ai/design/revise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            slideIndex,
            instruction: revisionInstruction,
            currentSlide,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Update the slide in local state
        setSlides((prev) =>
          prev.map((s, i) => (i === slideIndex ? data.revisedSlide : s))
        );
        setEditingSlide(null);
        setRevisionInstruction("");
        setDownloadUrl(null); // PDF needs re-generation
      } catch (err) {
        setError(err instanceof Error ? err.message : "修正に失敗しました");
      } finally {
        setRevisingSlide(null);
      }
    },
    [projectId, revisionInstruction, slides]
  );

  // Generate and download docx
  const downloadDocx = async () => {
    setDownloadingDocx(true);
    setError(null);

    try {
      const documentData = buildDocumentData(
        pageContents,
        projectTitle || "ドキュメント",
        clientName,
        outputType
      );

      const res = await fetch("/api/docx/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, documentData }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Word文書の生成に失敗しました"
      );
    } finally {
      setDownloadingDocx(false);
    }
  };

  // Complete design and move to review (or finish for documents)
  const completeDesign = async () => {
    const supabase = createClient();

    if (outputType === "document") {
      // ドキュメントはステップ5で完了（最終レビュー不要）
      await supabase
        .from("projects")
        .update({ current_step: 7, status: "completed" })
        .eq("id", projectId);
      router.push("/dashboard");
    } else {
      await supabase
        .from("projects")
        .update({ current_step: 6 })
        .eq("id", projectId);
      router.push(`/projects/${projectId}/design-review`);
    }
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
            <h2 className="text-lg font-bold text-navy">
              {outputType === "document" ? "ドキュメント生成" : "デザイン化 & PDF生成"}
            </h2>
            <p className="text-xs text-text-secondary">
              {outputType === "document"
                ? "作成した内容をWord文書としてダウンロードできます"
                : "AIがHTMLスライドを生成し、PDFでダウンロードできます"}
            </p>
          </div>
          <div className="flex gap-2">
            {outputType === "document" ? (
              <button
                onClick={downloadDocx}
                disabled={downloadingDocx || pageContents.length === 0}
                className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
              >
                {downloadingDocx ? "Word文書を生成中..." : "Word文書をダウンロード"}
              </button>
            ) : (
              <>
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
              </>
            )}
            <button
              onClick={completeDesign}
              disabled={outputType === "slide" && slides.length === 0}
              className="rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90 disabled:opacity-50"
            >
              {outputType === "document" ? "文書作成を完了" : "デザイン完了 → 最終レビューへ"}
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
              {outputType === "document" ? "Word文書が生成されました" : "PDFファイルが生成されました"}
            </p>
            <a
              href={downloadUrl}
              download
              className="inline-block rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90"
            >
              ダウンロード ({outputType === "document" ? ".docx" : ".pdf"})
            </a>
          </div>
        )}

        {/* ===== Document mode ===== */}
        {outputType === "document" && (
          <div className="rounded-lg border border-beige bg-white p-8">
            {pageContents.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-beige p-12 text-center">
                <p className="text-sm text-text-secondary">
                  ページコンテンツがまだ生成されていません。先に「詳細作成」を完了してください。
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy/10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-navy"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-navy">Word文書の生成</h3>
                    <p className="text-xs text-text-secondary">
                      {pageContents.length}セクション分の内容がWord文書に変換されます
                    </p>
                  </div>
                </div>
                <div className="rounded-md bg-off-white p-4">
                  <p className="mb-2 text-xs font-medium text-text-secondary">
                    含まれるセクション:
                  </p>
                  <ul className="space-y-1">
                    {pageContents.map((page, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-text-primary">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-navy/10 text-[10px] font-bold text-navy">
                          {i + 1}
                        </span>
                        {(page.title as string) || `セクション ${i + 1}`}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== Slide mode ===== */}
        {/* Empty state */}
        {outputType === "slide" && slides.length === 0 && !generating && (
          <div className="rounded-lg border-2 border-dashed border-beige p-12 text-center">
            <p className="text-sm text-text-secondary">
              {pageContents.length > 0
                ? "「HTMLスライドを生成」ボタンでAIがスライドをデザインします"
                : "ページコンテンツがまだ生成されていません。先に「詳細作成」を完了してください。"}
            </p>
          </div>
        )}

        {/* Generating state */}
        {outputType === "slide" && generating && (
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
        {outputType === "slide" && slides.length > 0 && !generating && (
          <div className="grid gap-4 md:grid-cols-2">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`rounded-lg border bg-white transition-all ${
                  revisingSlide === index
                    ? "border-navy/30 opacity-70"
                    : "border-beige"
                }`}
              >
                {/* Slide header */}
                <div className="flex items-center justify-between gap-2 border-b border-beige/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-medium text-navy">
                      {slide.slideType}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {index + 1} / {slides.length}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (editingSlide === index) {
                        setEditingSlide(null);
                        setRevisionInstruction("");
                      } else {
                        setEditingSlide(index);
                        setRevisionInstruction("");
                      }
                    }}
                    disabled={revisingSlide !== null}
                    className="flex-shrink-0 rounded p-1 text-text-secondary hover:bg-off-white hover:text-navy transition-colors disabled:opacity-50"
                    title="修正指示"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 4 4" />
                    </svg>
                  </button>
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

                {/* Revision instruction input */}
                {editingSlide === index && (
                  <div className="border-t border-beige/50 px-3 py-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={revisionInstruction}
                        onChange={(e) =>
                          setRevisionInstruction(e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            revisionInstruction.trim()
                          ) {
                            reviseSlide(index);
                          }
                        }}
                        placeholder="修正指示を入力（例: グラフの色を緑に変更）"
                        className="flex-1 rounded-md border border-beige bg-off-white px-3 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/50 focus:border-navy focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => reviseSlide(index)}
                        disabled={
                          !revisionInstruction.trim() ||
                          revisingSlide !== null
                        }
                        className="flex-shrink-0 rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
                      >
                        {revisingSlide === index ? "再生成中..." : "再生成"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Loading overlay */}
                {revisingSlide === index && (
                  <div className="px-3 pb-3 flex items-center gap-2 text-xs text-navy">
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-navy border-t-transparent" />
                    AIが修正中...
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
