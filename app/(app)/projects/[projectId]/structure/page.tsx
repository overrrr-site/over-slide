"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PageStructure {
  page_number: number;
  master_type: string;
  title: string;
  purpose: string;
  key_content: string;
  message?: string;
  notes?: string;
}

/* ─── Sortable Page Card ─── */
function SortablePageCard({
  page,
  masterTypeColors,
  editingPage,
  setEditingPage,
  revisionInstruction,
  setRevisionInstruction,
  revisePage,
  revisingPage,
  outputType,
  onMessageChange,
}: {
  page: PageStructure;
  masterTypeColors: Record<string, string>;
  editingPage: number | null;
  setEditingPage: (v: number | null) => void;
  revisionInstruction: string;
  setRevisionInstruction: (v: string) => void;
  revisePage: (pageNumber: number, currentPage: PageStructure) => void;
  revisingPage: number | null;
  outputType: string;
  onMessageChange: (pageNumber: number, message: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `page-${page.page_number}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-white p-3 transition-all ${
        revisingPage === page.page_number
          ? "border-navy/30 opacity-70"
          : isDragging
            ? "border-navy shadow-lg"
            : "border-beige"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 flex-shrink-0 cursor-grab touch-none rounded p-0.5 text-text-secondary hover:bg-off-white hover:text-navy active:cursor-grabbing"
          title="ドラッグして並び替え"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <circle cx="9" cy="5" r="1.5" />
            <circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" />
            <circle cx="15" cy="19" r="1.5" />
          </svg>
        </button>

        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-off-white text-xs font-bold text-navy">
          {page.page_number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {outputType !== "document" && (
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${masterTypeColors[page.master_type] || "bg-gray-100 text-gray-600"}`}
              >
                {page.master_type}
              </span>
            )}
            <h3 className="text-sm font-medium text-navy truncate">
              {page.title}
            </h3>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            {page.purpose}
          </p>
          {page.key_content && (
            <p className="mt-0.5 text-xs text-text-secondary italic">
              {page.key_content}
            </p>
          )}
          {/* ページメッセージ入力 */}
          <div className="mt-2">
            <input
              type="text"
              value={page.message || ""}
              onChange={(e) => onMessageChange(page.page_number, e.target.value)}
              maxLength={30}
              placeholder="このページで伝えること（30字以内）"
              className="w-full rounded border border-beige/70 bg-off-white px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary/40 focus:border-green focus:outline-none"
            />
            <div className="mt-0.5 text-right text-xs text-text-secondary/50">
              {(page.message || "").length}/30
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            if (editingPage === page.page_number) {
              setEditingPage(null);
              setRevisionInstruction("");
            } else {
              setEditingPage(page.page_number);
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

      {/* Revision instruction input */}
      {editingPage === page.page_number && (
        <div className="mt-3 border-t border-beige/50 pt-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={revisionInstruction}
              onChange={(e) => setRevisionInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && revisionInstruction.trim()) {
                  revisePage(page.page_number, page);
                }
              }}
              placeholder="修正指示を入力（例: もっと具体的なデータを含めて）"
              className="flex-1 rounded-md border border-beige bg-off-white px-3 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/50 focus:border-navy focus:outline-none"
              autoFocus
            />
            <button
              onClick={() => revisePage(page.page_number, page)}
              disabled={!revisionInstruction.trim() || revisingPage !== null}
              className="flex-shrink-0 rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
            >
              {revisingPage === page.page_number
                ? "再生成中..."
                : "再生成"}
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {revisingPage === page.page_number && (
        <div className="mt-2 flex items-center gap-2 text-xs text-navy">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-navy border-t-transparent" />
          AIが修正中...
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function StructurePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [briefSheet, setBriefSheet] = useState("");
  const [researchMemo, setResearchMemo] = useState("");
  const [pages, setPages] = useState<PageStructure[]>([]);
  const [generating, setGenerating] = useState(false);
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [revisingPage, setRevisingPage] = useState<number | null>(null);
  const [globalInstruction, setGlobalInstruction] = useState("");
  const [revisingAll, setRevisingAll] = useState(false);
  const [structureId, setStructureId] = useState<string | null>(null);
  const [outputType, setOutputType] = useState<string>("slide");
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 全ページのメッセージが入力済みかチェック
  const allMessagesConfirmed = pages.length > 0 && pages.every((p) => (p.message || "").trim().length > 0);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/structure",
        body: { projectId },
      }),
    [projectId]
  );

  const { messages, sendMessage, status } = useChat({ transport });

  const isStreaming = status === "streaming" || status === "submitted";

  // Load data
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const [briefResult, memoResult, structureResult, projectResult] = await Promise.all([
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
          .select("pages")
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

      if (briefResult.data?.raw_markdown)
        setBriefSheet(briefResult.data.raw_markdown);
      if (memoResult.data?.raw_markdown)
        setResearchMemo(memoResult.data.raw_markdown);
      if (structureResult.data?.pages)
        setPages(structureResult.data.pages as PageStructure[]);
      if (projectResult.data?.output_type)
        setOutputType(projectResult.data.output_type);

      // Also fetch structure ID for saving reordered pages
      const { data: structIdData } = await supabase
        .from("structures")
        .select("id")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (structIdData) setStructureId(structIdData.id);
    };
    load();
  }, [projectId]);

  // Parse generated structure from AI response
  useEffect(() => {
    if (messages.length === 0) return;
    const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
    if (!lastAssistant) return;

    const text = lastAssistant.parts
      .filter((p) => p.type === "text")
      .map((p) => ("text" in p ? p.text : ""))
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.pages) setPages(parsed.pages);
      } catch {
        // Not valid JSON yet (streaming)
      }
    }
  }, [messages]);

  const generateStructure = useCallback(async () => {
    setGenerating(true);
    sendMessage({
      text: JSON.stringify({ briefSheet, researchMemo }),
    });
    setGenerating(false);
  }, [briefSheet, researchMemo, sendMessage]);

  // Debounced save after reorder
  const saveReorderedPages = useCallback(
    (reorderedPages: PageStructure[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        if (!structureId) return;
        const supabase = createClient();
        await supabase
          .from("structures")
          .update({ pages: reorderedPages as unknown as Record<string, unknown>[] })
          .eq("id", structureId);
      }, 500);
    },
    [structureId]
  );

  // DnD handler
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setPages((prev) => {
        const oldIndex = prev.findIndex(
          (p) => `page-${p.page_number}` === active.id
        );
        const newIndex = prev.findIndex(
          (p) => `page-${p.page_number}` === over.id
        );
        if (oldIndex === -1 || newIndex === -1) return prev;

        const moved = arrayMove(prev, oldIndex, newIndex);
        // Renumber from 1
        const renumbered = moved.map((p, i) => ({
          ...p,
          page_number: i + 1,
        }));
        saveReorderedPages(renumbered);
        return renumbered;
      });
    },
    [saveReorderedPages]
  );

  const sortableIds = useMemo(
    () => pages.map((p) => `page-${p.page_number}`),
    [pages]
  );

  const masterTypeColors: Record<string, string> = {
    COVER: "bg-navy text-white",
    SECTION: "bg-green text-white",
    CONTENT_1COL: "bg-beige text-navy",
    CONTENT_2COL: "bg-beige text-navy",
    CONTENT_VISUAL: "bg-blue-100 text-blue-700",
    DATA_HIGHLIGHT: "bg-yellow-100 text-yellow-700",
    CLOSING: "bg-navy/80 text-white",
  };

  const revisePage = useCallback(
    async (pageNumber: number, currentPage: PageStructure) => {
      if (!revisionInstruction.trim()) return;
      setRevisingPage(pageNumber);
      try {
        const res = await fetch("/api/ai/structure/revise", {
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
        setPages((prev) =>
          prev.map((p) =>
            p.page_number === pageNumber
              ? { ...data.revisedPage, page_number: pageNumber }
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
        const res = await fetch("/api/ai/structure/revise-all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            instruction: globalInstruction,
            currentPages: pages,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setPages(data.revisedPages);
        setGlobalInstruction("");
      } catch (err) {
        console.error("Global revision failed:", err);
      } finally {
        setRevisingAll(false);
      }
    },
    [projectId, globalInstruction, pages]
  );

  // ページメッセージ変更ハンドラー
  const handleMessageChange = useCallback(
    (pageNumber: number, message: string) => {
      setPages((prev) =>
        prev.map((p) =>
          p.page_number === pageNumber ? { ...p, message } : p
        )
      );
      // メッセージ変更もdebounced saveで保存
      setPages((current) => {
        const updated = current.map((p) =>
          p.page_number === pageNumber ? { ...p, message } : p
        );
        saveReorderedPages(updated);
        return updated;
      });
    },
    [saveReorderedPages]
  );

  const completeStructure = async () => {
    const supabase = createClient();
    await supabase
      .from("projects")
      .update({ current_step: 3 })
      .eq("id", projectId);

    router.push(`/projects/${projectId}/details`);
  };

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">ページ構成</h2>
          <div className="flex gap-2">
            <button
              onClick={generateStructure}
              disabled={generating || isStreaming || !briefSheet}
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
            >
              {generating || isStreaming ? "生成中..." : "構成を生成"}
            </button>
            <button
              onClick={completeStructure}
              disabled={pages.length === 0 || !allMessagesConfirmed}
              className="rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90 disabled:opacity-50"
              title={!allMessagesConfirmed ? "全ページのメッセージを入力してください" : ""}
            >
              構成確定 → 詳細作成へ
            </button>
          </div>
        </div>

        {/* Global revision input */}
        {pages.length > 0 && (
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
                placeholder="全ページに対する修正指示（例: 各ページにデータ根拠を追加して）"
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

        {/* メッセージ未入力の警告 */}
        {pages.length > 0 && !allMessagesConfirmed && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-700">
            全ページの「伝えること」を入力すると、詳細作成に進めます。（{pages.filter((p) => (p.message || "").trim().length > 0).length}/{pages.length}ページ入力済み）
          </div>
        )}

        {pages.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-beige p-12 text-center">
            {generating || isStreaming ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-navy border-t-transparent" />
                <p className="text-sm font-medium text-navy">
                  AIがページ構成を考えています...
                </p>
                <p className="text-xs text-text-secondary">
                  1〜2分ほどかかります。このままお待ちください。
                </p>
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                ブリーフシートとリサーチメモをもとに、AI がページ構成を提案します。
              </p>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortableIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {pages.map((page) => (
                  <SortablePageCard
                    key={`page-${page.page_number}`}
                    page={page}
                    masterTypeColors={masterTypeColors}
                    editingPage={editingPage}
                    setEditingPage={setEditingPage}
                    revisionInstruction={revisionInstruction}
                    setRevisionInstruction={setRevisionInstruction}
                    revisePage={revisePage}
                    revisingPage={revisingPage}
                    outputType={outputType}
                    onMessageChange={handleMessageChange}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
