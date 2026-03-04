"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProjectChat } from "../chat/use-project-chat";
import type { ApplyPayload } from "../chat/use-project-chat";

export default function DetailsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [structure, setStructure] = useState<unknown>(null);
  const [researchMemo, setResearchMemo] = useState("");
  const [pageContents, setPageContents] = useState<Record<string, unknown>[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progressCount, setProgressCount] = useState(0);
  const [outputType, setOutputType] = useState<string>("slide");

  const { registerApplyHandler, summarizeCurrentStep } = useProjectChat();

  // Register handler for APPLY payloads from chat
  useEffect(() => {
    registerApplyHandler((payload: ApplyPayload) => {
      if (payload.action === "revise_page" && payload.revisedPage) {
        const revised = payload.revisedPage as Record<string, unknown>;
        setPageContents((prev) =>
          prev.map((p) =>
            (p.page_number as number) === (revised.page_number as number)
              ? { ...revised }
              : p
          )
        );
      } else if (payload.action === "revise_all" && payload.revisedPages) {
        setPageContents(payload.revisedPages as Record<string, unknown>[]);
      }
    });
  }, [registerApplyHandler]);

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
          .maybeSingle(),
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

  const completeDetails = async () => {
    await summarizeCurrentStep();
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
                  className="rounded-lg border border-beige bg-white p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
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

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
