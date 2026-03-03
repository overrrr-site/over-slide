"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DetailsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [structure, setStructure] = useState<unknown>(null);
  const [researchMemo, setResearchMemo] = useState("");
  const [pageContents, setPageContents] = useState<Record<string, unknown>[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [revisingPage, setRevisingPage] = useState<number | null>(null);
  const [globalInstruction, setGlobalInstruction] = useState("");
  const [revisingAll, setRevisingAll] = useState(false);
  const [outputType, setOutputType] = useState<string>("slide");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/details",
        body: { projectId },
      }),
    [projectId]
  );

  const { messages, sendMessage, status } = useChat({ transport });

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [memoResult, structureResult, projectResult] = await Promise.all([
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
        supabase
          .from("projects")
          .select("output_type")
          .eq("id", projectId)
          .single(),
      ]);

      if (memoResult.data?.raw_markdown)
        setResearchMemo(memoResult.data.raw_markdown);
      if (structureResult.data?.pages)
        setStructure(structureResult.data.pages);
      if (projectResult.data?.output_type)
        setOutputType(projectResult.data.output_type);

      // Load existing page_contents from DB (same pattern as design page)
      if (structureResult.data?.id) {
        const { data: contents } = await supabase
          .from("page_contents")
          .select("page_number, content")
          .eq("structure_id", structureResult.data.id)
          .order("page_number");

        if (contents?.length) {
          setPageContents(
            contents.map((c) => c.content as Record<string, unknown>)
          );
        }
      }
    };
    load();
  }, [projectId]);

  // Parse details from AI response + track progress
  useEffect(() => {
    if (messages.length === 0) return;
    const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
    if (!lastAssistant) return;

    const text = lastAssistant.parts
      .filter((p) => p.type === "text")
      .map((p) => ("text" in p ? p.text : ""))
      .join("");

    // Count pages generated so far (even before full JSON is parseable)
    const pageMatches = text.match(/"page_number"\s*:\s*\d+/g);
    if (pageMatches) setProgressCount(pageMatches.length);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.pages) setPageContents(parsed.pages);
      } catch {
        // Not valid JSON yet
      }
    }
  }, [messages]);

  const totalPages = Array.isArray(structure) ? (structure as unknown[]).length : 0;

  const generateDetails = useCallback(async () => {
    setGenerating(true);
    setProgressCount(0);
    sendMessage({
      text: JSON.stringify({ structure, researchMemo }),
    });
    setGenerating(false);
  }, [structure, researchMemo, sendMessage]);

  const revisePage = useCallback(
    async (pageNumber: number, currentPage: Record<string, unknown>) => {
      if (!revisionInstruction.trim()) return;
      setRevisingPage(pageNumber);
      try {
        const res = await fetch("/api/ai/details/revise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            pageNumber,
            instruction: revisionInstruction,
            currentPage,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Update the page in local state
        setPageContents((prev) =>
          prev.map((p) =>
            (p.page_number as number) === pageNumber
              ? data.revisedPage
              : p
          )
        );
        setEditingPage(null);
        setRevisionInstruction("");
      } catch (err) {
        console.error("Revision failed:", err);
      } finally {
        setRevisingPage(null);
      }
    },
    [projectId, revisionInstruction]
  );

  const reviseAll = useCallback(
    async () => {
      if (!globalInstruction.trim()) return;
      setRevisingAll(true);
      try {
        const res = await fetch("/api/ai/details/revise-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            instruction: globalInstruction,
            currentPages: pageContents,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPageContents(data.revisedPages);
        setGlobalInstruction("");
      } catch (err) {
        console.error("Global revision failed:", err);
      } finally {
        setRevisingAll(false);
      }
    },
    [projectId, globalInstruction, pageContents]
  );

  const completeDetails = async () => {
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ current_step: 4 })
      .eq("id", projectId);

    router.push(`/projects/${projectId}/content-review`);
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">ページ詳細作成</h2>
          <div className="flex gap-2">
            <button
              onClick={generateDetails}
              disabled={generating || isStreaming || !structure}
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
            >
              {generating || isStreaming
                ? totalPages > 0
                  ? `${progressCount} / ${totalPages} ページ生成中...`
                  : "生成中..."
                : "詳細を生成"}
            </button>
            <button
              onClick={completeDetails}
              disabled={pageContents.length === 0}
              className="rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90 disabled:opacity-50"
            >
              詳細確定 → 内容レビューへ
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {(generating || isStreaming) && totalPages > 0 && (
          <div className="mb-4 overflow-hidden rounded-full bg-beige/50">
            <div
              className="h-1.5 rounded-full bg-green transition-all duration-500"
              style={{ width: `${Math.min((progressCount / totalPages) * 100, 100)}%` }}
            />
          </div>
        )}

        {/* Global revision input */}
        {pageContents.length > 0 && (
          <div className="mb-4 rounded-lg border border-beige bg-white p-3">
            <label className="text-xs font-medium text-text-secondary mb-1 block">
              全体修正指示
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={globalInstruction}
                onChange={(e) => setGlobalInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && globalInstruction.trim() && !revisingAll) {
                    reviseAll();
                  }
                }}
                placeholder="全ページに対する修正指示（例: すべてのページに具体的な数値を追加して）"
                className="flex-1 rounded-md border border-beige bg-off-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/50 focus:border-navy focus:outline-none"
                disabled={revisingAll}
              />
              <button
                onClick={reviseAll}
                disabled={revisingAll || !globalInstruction.trim()}
                className="flex-shrink-0 rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
              >
                {revisingAll ? "全体修正中..." : "全体修正"}
              </button>
            </div>
          </div>
        )}

        {pageContents.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-beige p-12 text-center">
            <p className="text-sm text-text-secondary">
              構成をもとに、AIが各ページの詳細コンテンツを生成します。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pageContents.map((page, index) => {
              const pageNum = (page.page_number as number) || index + 1;
              return (
                <div
                  key={index}
                  className={`rounded-lg border bg-white p-4 transition-all ${
                    revisingPage === pageNum
                      ? "border-navy/30 opacity-70"
                      : "border-beige"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="rounded bg-navy/10 px-1.5 py-0.5 text-xs font-medium text-navy">
                        P{pageNum}
                      </span>
                      {outputType !== "document" && (
                        <span className="rounded bg-green/10 px-1.5 py-0.5 text-xs font-medium text-green">
                          {page.master_type as string}
                        </span>
                      )}
                      <h3 className="text-sm font-medium text-navy truncate">
                        {page.title as string}
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        if (editingPage === pageNum) {
                          setEditingPage(null);
                          setRevisionInstruction("");
                        } else {
                          setEditingPage(pageNum);
                          setRevisionInstruction("");
                        }
                      }}
                      disabled={revisingPage !== null}
                      className="flex-shrink-0 rounded p-1 text-text-secondary hover:bg-off-white hover:text-navy transition-colors disabled:opacity-50"
                      title="修正指示"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        <path d="m15 5 4 4"/>
                      </svg>
                    </button>
                  </div>

                  {typeof page.body === "string" && page.body && (
                    <p className="text-xs text-text-primary whitespace-pre-wrap mb-2">
                      {page.body}
                    </p>
                  )}

                  {Array.isArray(page.bullets) && (page.bullets as Array<{ text: string }>).length > 0 && (
                    <ul className="space-y-0.5 text-xs text-text-primary">
                      {(page.bullets as Array<{ text: string; icon?: string }>).map((b, bi) => (
                        <li key={bi} className="flex items-start gap-1">
                          <span className="text-green">•</span>
                          {b.text}
                        </li>
                      ))}
                    </ul>
                  )}

                  {Array.isArray(page.kpis) && (page.kpis as Array<{ value: string; label: string }>).length > 0 && (
                    <div className="mt-2 flex gap-3">
                      {(page.kpis as Array<{ value: string; label: string }>).map((kpi, ki) => (
                        <div
                          key={ki}
                          className="rounded bg-off-white px-3 py-2 text-center"
                        >
                          <p className="text-lg font-bold text-navy">
                            {kpi.value}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {kpi.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Revision instruction input */}
                  {editingPage === pageNum && (
                    <div className="mt-3 border-t border-beige/50 pt-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={revisionInstruction}
                          onChange={(e) => setRevisionInstruction(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && revisionInstruction.trim()) {
                              revisePage(pageNum, page);
                            }
                          }}
                          placeholder="修正指示を入力（例: 具体的な数値データを追加して）"
                          className="flex-1 rounded-md border border-beige bg-off-white px-3 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/50 focus:border-navy focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={() => revisePage(pageNum, page)}
                          disabled={!revisionInstruction.trim() || revisingPage !== null}
                          className="flex-shrink-0 rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
                        >
                          {revisingPage === pageNum ? "再生成中..." : "再生成"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Loading overlay */}
                  {revisingPage === pageNum && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-navy">
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-navy border-t-transparent" />
                      AIが修正中...
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
