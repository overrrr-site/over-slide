"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PROJECT_TYPES } from "@/lib/quotes/constants";
import type { QuoteAction, QuoteItemRow } from "@/lib/quotes/types";
import { formatCurrency } from "@/lib/quotes/calculations";
import {
  normalizeQuoteWorkspaceItems,
  sanitizeWorkspaceProjectTypeIds,
  type QuoteWorkspaceItem,
  type QuoteWorkspaceReferenceMaterial,
} from "@/lib/quotes/workspace-schema";

type WorkspaceDraft = {
  suggestedProjectTypes: string[];
  confidence: number;
  rationale: string;
  items: QuoteWorkspaceItem[];
};

type BrainstormListItem = {
  id: string;
  title: string;
  client_name: string;
};

type WorkspaceMessage = {
  role: "user" | "assistant";
  text: string;
};

type MaterialListItem = {
  id: string;
  title: string;
  fileType: "pdf" | "docx";
  createdAt: string;
};

type LoadedMaterial = QuoteWorkspaceReferenceMaterial & {
  id: string;
  truncated?: boolean;
  originalChars?: number;
};

type Props = {
  projectTypes: string[];
  existingItems: QuoteItemRow[];
  originBrainstormId: string;
  orientSheetMarkdown: string;
  onOriginBrainstormIdChange: (brainstormId: string) => void;
  onOrientSheetMarkdownChange: (text: string) => void;
  dispatch: React.Dispatch<QuoteAction>;
};

const PROJECT_TYPE_MAP = new Map(PROJECT_TYPES.map((type) => [type.id, type.label]));

function toWorkspaceItems(items: QuoteItemRow[]): QuoteWorkspaceItem[] {
  return items
    .filter((item) => item.name.trim() !== "")
    .map((item) => ({
      category: item.category,
      name: item.name,
      description: item.description,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      unit: item.unit,
    }));
}

function buildFallbackOrient(session: Record<string, unknown>): string {
  const fields = [
    ["クライアント", session.client_info],
    ["背景・課題", session.background],
    ["提案の方向性", session.hypothesis],
    ["ゴール", session.goal],
    ["制約条件", session.constraints],
    ["リサーチで確認すべきこと", session.research_topics],
    ["構成の骨格案", session.structure_draft],
  ] as const;

  return fields
    .map(([label, value]) => `${label}: ${typeof value === "string" && value.trim() ? value.trim() : "（未入力）"}`)
    .join("\n");
}

export function QuoteAiWorkspace({
  projectTypes,
  existingItems,
  originBrainstormId,
  orientSheetMarkdown,
  onOriginBrainstormIdChange,
  onOrientSheetMarkdownChange,
  dispatch,
}: Props) {
  const [brainstorms, setBrainstorms] = useState<BrainstormListItem[]>([]);
  const [loadingBrainstorms, setLoadingBrainstorms] = useState(false);
  const [loadingOrient, setLoadingOrient] = useState(false);
  const [materials, setMaterials] = useState<MaterialListItem[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [loadingMaterialText, setLoadingMaterialText] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [referenceMaterials, setReferenceMaterials] = useState<LoadedMaterial[]>([]);

  const [generatingInitial, setGeneratingInitial] = useState(false);
  const [revisingDraft, setRevisingDraft] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [draft, setDraft] = useState<WorkspaceDraft | null>(null);
  const [reviseInstruction, setReviseInstruction] = useState("");
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);

  const currentItems = useMemo(() => toWorkspaceItems(existingItems), [existingItems]);

  const loadBrainstormList = useCallback(async () => {
    setLoadingBrainstorms(true);
    try {
      const response = await fetch("/api/brainstorms");
      const data = await response.json().catch(() => []);
      if (!response.ok || !Array.isArray(data)) {
        throw new Error(data?.error || "ブレスト一覧の取得に失敗しました");
      }
      setBrainstorms(
        data
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const item = row as Partial<BrainstormListItem>;
            if (!item.id || !item.title) return null;
            return {
              id: item.id,
              title: item.title,
              client_name: item.client_name || "",
            };
          })
          .filter((item): item is BrainstormListItem => item !== null)
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ブレスト一覧の取得に失敗しました";
      setNotice(message);
    } finally {
      setLoadingBrainstorms(false);
    }
  }, []);

  const loadMaterialList = useCallback(async () => {
    setLoadingMaterials(true);
    try {
      const response = await fetch("/api/quotes/materials");
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(data?.materials)) {
        throw new Error(data?.error || "資料一覧の取得に失敗しました");
      }
      const next = data.materials
        .map((row: unknown) => {
          if (!row || typeof row !== "object") return null;
          const item = row as Partial<MaterialListItem>;
          if (
            !item.id ||
            (item.fileType !== "pdf" && item.fileType !== "docx") ||
            !item.title ||
            !item.createdAt
          ) {
            return null;
          }
          return {
            id: item.id,
            title: item.title,
            fileType: item.fileType,
            createdAt: item.createdAt,
          } satisfies MaterialListItem;
        })
        .filter((item: MaterialListItem | null): item is MaterialListItem => item !== null);
      setMaterials(next);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "資料一覧の取得に失敗しました";
      setNotice(message);
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  useEffect(() => {
    void loadBrainstormList();
  }, [loadBrainstormList]);

  useEffect(() => {
    void loadMaterialList();
  }, [loadMaterialList]);

  const applySuggestedTypes = useCallback(
    (types: string[]) => {
      const normalized = sanitizeWorkspaceProjectTypeIds(types);
      if (normalized.length === 0) return;
      dispatch({ type: "SET_PROJECT_TYPES", types: normalized });
    },
    [dispatch]
  );

  const loadSelectedBrainstorm = useCallback(async () => {
    if (!originBrainstormId) return;

    setLoadingOrient(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/brainstorms/${originBrainstormId}`);
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.session) {
        throw new Error(data?.error || "ブレスト読込に失敗しました");
      }

      const session = data.session as Record<string, unknown>;
      const markdown =
        (typeof session.raw_markdown === "string" && session.raw_markdown.trim())
          ? session.raw_markdown.trim()
          : buildFallbackOrient(session);

      onOrientSheetMarkdownChange(markdown);
      setNotice("オリエンシートを読み込みました");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ブレスト読込に失敗しました";
      setNotice(message);
    } finally {
      setLoadingOrient(false);
    }
  }, [onOrientSheetMarkdownChange, originBrainstormId]);

  const loadSelectedMaterial = useCallback(async () => {
    if (!selectedMaterialId || loadingMaterialText) return;

    setLoadingMaterialText(true);
    setNotice(null);

    try {
      const response = await fetch("/api/quotes/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: selectedMaterialId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "資料読込に失敗しました");
      }

      if (typeof data?.text !== "string" || !data.text.trim()) {
        throw new Error("資料から抽出できる本文がありませんでした");
      }

      const loaded: LoadedMaterial = {
        id: typeof data.id === "string" ? data.id : selectedMaterialId,
        title: typeof data.title === "string" ? data.title : "資料",
        fileType: data.fileType === "docx" ? "docx" : "pdf",
        text: data.text,
        truncated: !!data.truncated,
        originalChars:
          typeof data.originalChars === "number" ? data.originalChars : undefined,
      };

      setReferenceMaterials((prev) => {
        const filtered = prev.filter((item) => item.id !== loaded.id);
        return [...filtered, loaded];
      });

      setNotice(
        loaded.truncated
          ? "資料本文を読み込みました（長文のため一部省略）"
          : "資料本文を読み込みました"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "資料読込に失敗しました";
      setNotice(message);
    } finally {
      setLoadingMaterialText(false);
    }
  }, [loadingMaterialText, selectedMaterialId]);

  const removeLoadedMaterial = useCallback((materialId: string) => {
    setReferenceMaterials((prev) => prev.filter((item) => item.id !== materialId));
  }, []);

  const runInitialGeneration = useCallback(async () => {
    setGeneratingInitial(true);
    setNotice(null);

    try {
      const response = await fetch("/api/ai/quote-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "initial",
          orientSheetMarkdown,
          referenceMaterials,
          projectTypes,
          currentItems,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "見積案の生成に失敗しました");
      }

      const nextDraft: WorkspaceDraft = {
        suggestedProjectTypes: Array.isArray(data.suggestedProjectTypes)
          ? data.suggestedProjectTypes.filter((item: unknown): item is string => typeof item === "string")
          : [],
        confidence: typeof data.confidence === "number" ? data.confidence : 0.5,
        rationale: typeof data.rationale === "string" ? data.rationale : "",
        items: normalizeQuoteWorkspaceItems(data.items),
      };

      setDraft(nextDraft);
      setNotice(
        orientSheetMarkdown.trim() || referenceMaterials.length > 0
          ? "見積案を生成しました。プレビューを確認して反映してください"
          : "オリエン/資料未入力で生成しました。精度に注意してください"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "見積案の生成に失敗しました";
      setNotice(message);
    } finally {
      setGeneratingInitial(false);
    }
  }, [currentItems, orientSheetMarkdown, projectTypes, referenceMaterials]);

  const applyAllDraftItems = useCallback(() => {
    if (!draft || draft.items.length === 0) return;

    applySuggestedTypes(draft.suggestedProjectTypes);
    dispatch({ type: "ADD_SUGGESTED_ITEMS", items: draft.items });
    setDraft(null);
    setNotice("提案明細を反映しました");
  }, [applySuggestedTypes, dispatch, draft]);

  const applySingleDraftItem = useCallback(
    (targetIndex: number) => {
      if (!draft || !draft.items[targetIndex]) return;

      applySuggestedTypes(draft.suggestedProjectTypes);
      dispatch({ type: "ADD_SUGGESTED_ITEMS", items: [draft.items[targetIndex]] });

      const remaining = draft.items.filter((_, index) => index !== targetIndex);
      setDraft({ ...draft, items: remaining });
      setNotice("明細を1件反映しました");
    },
    [applySuggestedTypes, dispatch, draft]
  );

  const reviseDraftByInstruction = useCallback(async () => {
    const instruction = reviseInstruction.trim();
    if (!instruction || revisingDraft) return;

    setRevisingDraft(true);
    setNotice(null);

    try {
      const response = await fetch("/api/ai/quote-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "revise",
          orientSheetMarkdown,
          referenceMaterials,
          projectTypes,
          currentItems,
          draftItems: draft?.items || [],
          instruction,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "見積案の修正に失敗しました");
      }

      const nextItems = normalizeQuoteWorkspaceItems(data.items);

      const nextTypes = Array.isArray(data.suggestedProjectTypes)
        ? data.suggestedProjectTypes.filter((item: unknown): item is string => typeof item === "string")
        : draft?.suggestedProjectTypes || [];

      setDraft({
        suggestedProjectTypes: nextTypes,
        confidence: draft?.confidence ?? 0.5,
        rationale: typeof data.rationale === "string" ? data.rationale : "",
        items: nextItems,
      });

      setMessages((prev) => [
        ...prev,
        { role: "user", text: instruction },
        {
          role: "assistant",
          text:
            typeof data.rationale === "string" && data.rationale.trim()
              ? `見積案を更新しました: ${data.rationale}`
              : "見積案を更新しました。プレビューを確認してください。",
        },
      ]);
      setReviseInstruction("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "見積案の修正に失敗しました";
      setNotice(message);
    } finally {
      setRevisingDraft(false);
    }
  }, [
    currentItems,
    draft,
    orientSheetMarkdown,
    projectTypes,
    referenceMaterials,
    reviseInstruction,
    revisingDraft,
  ]);

  return (
    <section className="rounded-lg border border-beige bg-white p-5">
      <h2 className="text-sm font-bold text-navy">Step 1. AI見積ワークスペース（推奨）</h2>
      <p className="mt-1 text-xs text-text-secondary">
        ここから始めると、明細のたたき台を短時間で作成できます。
      </p>

      <div className="mt-4 space-y-4">
        <div className="rounded border border-beige/60 bg-off-white p-3">
          <p className="text-xs font-medium text-navy">1. オリエン入力</p>

          <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={originBrainstormId}
              onChange={(event) => onOriginBrainstormIdChange(event.target.value)}
              className="min-w-0 flex-1 rounded border border-beige bg-white px-2 py-1.5 text-xs text-text-primary focus:border-green focus:outline-none"
            >
              <option value="">ブレストを選択（任意）</option>
              {brainstorms.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                  {item.client_name ? ` / ${item.client_name}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadSelectedBrainstorm}
              disabled={loadingOrient || !originBrainstormId}
              className="shrink-0 whitespace-nowrap rounded border border-beige bg-white px-2 py-1.5 text-xs text-text-secondary hover:bg-off-white disabled:opacity-50"
            >
              {loadingOrient ? "読込中..." : "読込"}
            </button>
            <button
              type="button"
              onClick={() => void loadBrainstormList()}
              disabled={loadingBrainstorms}
              className="shrink-0 whitespace-nowrap rounded border border-beige bg-white px-2 py-1.5 text-xs text-text-secondary hover:bg-off-white disabled:opacity-50"
            >
              {loadingBrainstorms ? "更新中..." : "更新"}
            </button>
          </div>

          <textarea
            value={orientSheetMarkdown}
            onChange={(event) => onOrientSheetMarkdownChange(event.target.value)}
            rows={7}
            placeholder="オリエンシート本文を貼り付け"
            className="mt-2 w-full rounded border border-beige bg-white px-3 py-2 text-xs text-text-primary focus:border-green focus:outline-none"
          />

          <div className="mt-2 rounded border border-beige/70 bg-white p-2">
            <p className="text-[11px] font-medium text-text-secondary">
              作成済み資料から読込（PDF / DOCX）
            </p>
            <div className="mt-1.5 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={selectedMaterialId}
                onChange={(event) => setSelectedMaterialId(event.target.value)}
                className="min-w-0 flex-1 rounded border border-beige bg-off-white px-2 py-1.5 text-xs text-text-primary focus:border-green focus:outline-none"
              >
                <option value="">資料を選択</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadSelectedMaterial}
                disabled={loadingMaterialText || !selectedMaterialId}
                className="shrink-0 whitespace-nowrap rounded border border-beige bg-white px-2 py-1.5 text-xs text-text-secondary hover:bg-off-white disabled:opacity-50"
              >
                {loadingMaterialText ? "読込中..." : "本文読込"}
              </button>
              <button
                type="button"
                onClick={() => void loadMaterialList()}
                disabled={loadingMaterials}
                className="shrink-0 whitespace-nowrap rounded border border-beige bg-white px-2 py-1.5 text-xs text-text-secondary hover:bg-off-white disabled:opacity-50"
              >
                {loadingMaterials ? "更新中..." : "更新"}
              </button>
            </div>

            {referenceMaterials.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {referenceMaterials.map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center justify-between rounded border border-beige/70 bg-off-white px-2 py-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-navy">
                        {material.title}
                      </p>
                      <p className="text-[10px] text-text-secondary">
                        {material.fileType.toUpperCase()}
                        {typeof material.originalChars === "number"
                          ? ` / ${material.originalChars.toLocaleString()}文字`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLoadedMaterial(material.id)}
                      className="rounded px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-red-50 hover:text-red-500"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!orientSheetMarkdown.trim() && referenceMaterials.length === 0 && (
            <p className="mt-1 text-[11px] text-amber-700">
              オリエン/資料未入力でも生成できますが、提案精度は下がります。
            </p>
          )}
        </div>

        <div className="rounded border border-beige/60 bg-off-white p-3">
          <p className="text-xs font-medium text-navy">2. 初回案生成</p>
          <button
            type="button"
            onClick={runInitialGeneration}
            disabled={generatingInitial}
            className="mt-2 w-full rounded bg-navy px-3 py-2 text-xs font-medium text-white hover:bg-navy/90 disabled:opacity-50"
          >
            {generatingInitial ? "生成中..." : "見積案を生成"}
          </button>
        </div>

        <div
          className={`rounded border p-3 ${
            draft ? "border-green/30 bg-green/5" : "border-beige/60 bg-off-white"
          }`}
        >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-navy">3. プレビュー承認</p>
              {draft && (
                <button
                  type="button"
                  onClick={applyAllDraftItems}
                  disabled={draft.items.length === 0}
                  className="rounded bg-green px-2.5 py-1 text-[11px] font-medium text-white hover:bg-green/90 disabled:opacity-50"
                >
                  全件反映（{draft.items.length}件）
                </button>
              )}
            </div>

            {draft && draft.suggestedProjectTypes.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] text-text-secondary">提案タイプ（反映時に適用）</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {draft.suggestedProjectTypes.map((typeId) => (
                    <span
                      key={typeId}
                      className="rounded-full border border-navy/20 bg-white px-2 py-0.5 text-[10px] text-navy"
                    >
                      {PROJECT_TYPE_MAP.get(typeId) || typeId}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {draft && draft.confidence < 0.5 && (
              <p className="mt-2 text-[11px] text-amber-700">
                推定一致度が低いため、案件タイプに「その他」を含む提案です。
              </p>
            )}

            {draft?.rationale && (
              <p className="mt-2 text-[11px] text-text-secondary">根拠: {draft.rationale}</p>
            )}

            {draft ? (
              <div className="mt-2 space-y-1.5">
                {draft.items.map((item, index) => (
                  <div
                    key={`${item.category}-${item.name}-${index}`}
                    className="flex items-center justify-between rounded border border-beige/60 bg-white px-2 py-1.5"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs font-medium text-navy">
                        [{item.category}] {item.name}
                      </p>
                      <p className="text-[10px] text-text-secondary">
                        ¥{formatCurrency(item.unitPrice)} × {item.quantity}
                        {item.unit}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applySingleDraftItem(index)}
                      className="rounded border border-green px-2 py-1 text-[11px] text-green hover:bg-green/10"
                    >
                      個別反映
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-text-secondary">
                まだプレビューはありません。「2. 初回案生成」を実行するとここに表示されます。
              </p>
            )}
          </div>

        <div className="rounded border border-beige/60 bg-off-white p-3">
          <p className="text-xs font-medium text-navy">4. チャット修正</p>

          <div className="mt-2 max-h-32 space-y-1 overflow-auto rounded border border-beige bg-white p-2">
            {messages.length === 0 ? (
              <p className="text-[11px] text-text-secondary">
                例: 「単価を抑えて」「撮影を外して」
              </p>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded px-2 py-1 text-[11px] ${
                    message.role === "user"
                      ? "bg-off-white text-text-primary"
                      : "bg-green/10 text-green"
                  }`}
                >
                  {message.text}
                </div>
              ))
            )}
          </div>

          <textarea
            value={reviseInstruction}
            onChange={(event) => setReviseInstruction(event.target.value)}
            rows={3}
            placeholder="修正したい内容を入力"
            className="mt-2 w-full rounded border border-beige bg-white px-3 py-2 text-xs text-text-primary focus:border-green focus:outline-none"
          />

          <button
            type="button"
            onClick={reviseDraftByInstruction}
            disabled={revisingDraft || !reviseInstruction.trim()}
            className="mt-2 w-full rounded bg-navy px-3 py-2 text-xs font-medium text-white hover:bg-navy/90 disabled:opacity-50"
          >
            {revisingDraft ? "修正中..." : "指示して見積案を更新"}
          </button>
        </div>

        {notice && <p className="text-xs text-text-secondary">{notice}</p>}
      </div>
    </section>
  );
}
