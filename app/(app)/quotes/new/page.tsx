"use client";

import {
  useReducer,
  useMemo,
  useEffect,
  useCallback,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import type { Quote, QuoteItem } from "@/lib/quotes/types";
import {
  PROJECT_TYPES,
  QUOTE_STATUSES,
  SALES_MEMBERS,
  NOTE_TEMPLATES,
  groupNotesByType,
} from "@/lib/quotes/constants";
import {
  calcSubtotal,
  calcTax,
  calcTotal,
  formatCurrency,
} from "@/lib/quotes/calculations";
import { QuoteAiWorkspace } from "./quote-ai-workspace";
import { SortableItemRow } from "./sortable-item-row";
import { addDays, createInitialState, quoteReducer } from "./quote-form-state";

// ============================================================
// メイン: 見積作成ページ
// ============================================================

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export default function QuoteNewPage() {
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-secondary">読み込み中...</p>
      </div>
    );
  }

  return <QuoteForm />;
}

export function QuoteForm({
  quoteId,
  initialQuote,
  initialItems,
}: {
  quoteId?: string;
  initialQuote?: Quote;
  initialItems?: QuoteItem[];
} = {}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(quoteReducer, undefined, () => {
    if (initialQuote && initialItems) {
      return quoteReducer(createInitialState(), {
        type: "LOAD_QUOTE",
        quote: initialQuote,
        items: initialItems,
      });
    }
    return createInitialState();
  });

  // 見積番号の自動採番（新規時のみ）
  useEffect(() => {
    if (quoteId) return; // 編集時はスキップ
    fetch("/api/quotes/number")
      .then((res) => res.json())
      .then((data) => {
        if (data.quoteNumber) {
          dispatch({ type: "SET_FIELD", field: "quoteNumber", value: data.quoteNumber });
        }
      });
  }, [quoteId]);

  // ドラッグ&ドロップ設定
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = state.items.findIndex((i) => i.tempId === active.id);
      const newIndex = state.items.findIndex((i) => i.tempId === over.id);
      const reordered = arrayMove(state.items, oldIndex, newIndex);
      dispatch({ type: "REORDER_ITEMS", items: reordered });
    },
    [state.items]
  );

  // 集計値（useMemoで毎回導出）
  const summary = useMemo(() => {
    const subtotal = calcSubtotal(state.items);
    const tax = calcTax(subtotal);
    const total = calcTotal(subtotal, tax);
    return {
      subtotal,
      tax,
      total,
    };
  }, [state.items]);

  // 備考グループ化（案件タイプ別に折りたたみ表示用）
  const noteGroups = useMemo(() => {
    const filtered = state.notes.filter((note) => {
      const tmpl = NOTE_TEMPLATES.find((t) => t.id === note.id);
      if (!tmpl) return true;
      return (
        tmpl.applicableTypes.includes("all") ||
        tmpl.applicableTypes.some((t) => state.projectTypes.includes(t))
      );
    });
    return groupNotesByType(filtered, state.projectTypes);
  }, [state.notes, state.projectTypes]);

  // 保存処理
  const handleSave = async () => {
    dispatch({ type: "SET_SAVING", saving: true });

    const payload = {
      quoteNumber: state.quoteNumber,
      clientName: state.clientName,
      projectName: state.projectName,
      originBrainstormId: state.originBrainstormId || null,
      orientSheetMarkdown: state.orientSheetMarkdown,
      projectTypes: state.projectTypes,
      status: state.status,
      issuedAt: state.issuedAt,
      expiresAt: state.expiresAt,
      subtotal: summary.subtotal,
      tax: summary.tax,
      total: summary.total,
      notes: state.notes,
      assignedSales: state.assignedSales,
      items: state.items.map((item) => ({
        category: item.category,
        name: item.name,
        description: item.description,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        unit: item.unit,
        amount: item.amount,
      })),
    };

    try {
      const url = quoteId ? `/api/quotes/${quoteId}` : "/api/quotes";
      const method = quoteId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`保存に失敗しました: ${err.error}`);
        dispatch({ type: "SET_SAVING", saving: false });
        return;
      }

      const data = await res.json();
      dispatch({ type: "MARK_SAVED" });

      // 新規作成の場合は編集画面に遷移
      if (!quoteId && data.id) {
        router.replace(`/quotes/${data.id}`);
      }
    } catch {
      alert("保存に失敗しました");
      dispatch({ type: "SET_SAVING", saving: false });
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl p-6">
        {/* ヘッダー */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">
              {quoteId ? "見積を編集" : "新しい見積を作成"}
            </h1>
            {state.lastSavedAt && (
              <p className="mt-1 text-xs text-text-secondary">
                最終保存: {new Date(state.lastSavedAt).toLocaleString("ja-JP")}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {quoteId && (
              <button
                type="button"
                onClick={() => window.open(`/quotes/${quoteId}/print`, "_blank")}
                className="rounded-md border border-beige px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-off-white"
              >
                PDF出力
              </button>
            )}
            <button
              type="button"
              onClick={() => router.push("/quotes")}
              className="rounded-md border border-beige px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-off-white"
            >
              一覧に戻る
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={state.saving}
              className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50"
            >
              {state.saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-beige bg-gradient-to-r from-white to-off-white p-5">
            <p className="text-sm font-bold text-navy">開始ガイド</p>
            <p className="mt-1 text-xs text-text-secondary">
              まずは「Step 1: AI生成」から始めるのが推奨です。手入力は必要な分だけ追加してください。
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <a
                href="#quote-ai-workspace"
                className="rounded-md border border-navy bg-navy px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-navy/90"
              >
                Step 1 (推奨): AIで明細案を作る
              </a>
              <a
                href="#quote-basic"
                className="rounded-md border border-beige bg-white px-3 py-2 text-xs font-medium text-navy transition-colors hover:bg-off-white"
              >
                Step 2 (必須): 基本情報を入力
              </a>
              <a
                href="#quote-items"
                className="rounded-md border border-beige bg-white px-3 py-2 text-xs font-medium text-navy transition-colors hover:bg-off-white"
              >
                Step 3 (任意): 手入力で明細を追加・調整
              </a>
              <a
                href="#quote-notes"
                className="rounded-md border border-beige bg-white px-3 py-2 text-xs font-medium text-navy transition-colors hover:bg-off-white"
              >
                Step 4 (任意): 備考を確認
              </a>
            </div>
          </section>

          <section id="quote-ai-workspace" className="scroll-mt-6">
            <QuoteAiWorkspace
              projectTypes={state.projectTypes}
              existingItems={state.items}
              originBrainstormId={state.originBrainstormId}
              orientSheetMarkdown={state.orientSheetMarkdown}
              onOriginBrainstormIdChange={(brainstormId) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "originBrainstormId",
                  value: brainstormId,
                })
              }
              onOrientSheetMarkdownChange={(text) =>
                dispatch({
                  type: "SET_FIELD",
                  field: "orientSheetMarkdown",
                  value: text,
                })
              }
              dispatch={dispatch}
            />
          </section>

          {/* 基本情報 */}
          <section
            id="quote-basic"
            className="scroll-mt-6 rounded-lg border border-beige bg-white p-5"
          >
            <h2 className="mb-4 text-sm font-bold text-navy">Step 2. 基本情報</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  案件名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={state.projectName}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "projectName", value: e.target.value })
                  }
                  className="w-full rounded-md border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                  placeholder="例: コーポレートサイトリニューアル"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  クライアント名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={state.clientName}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "clientName", value: e.target.value })
                  }
                  className="w-full rounded-md border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                  placeholder="例: 株式会社〇〇"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  見積番号
                </label>
                <input
                  type="text"
                  value={state.quoteNumber}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "quoteNumber", value: e.target.value })
                  }
                  className="w-full rounded-md border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  担当営業
                </label>
                <select
                  value={state.assignedSales}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "assignedSales", value: e.target.value })
                  }
                  className="w-full rounded-md border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                >
                  <option value="">選択してください</option>
                  {SALES_MEMBERS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  発行日
                </label>
                <input
                  type="date"
                  value={state.issuedAt}
                  onChange={(e) => {
                    dispatch({ type: "SET_FIELD", field: "issuedAt", value: e.target.value });
                    dispatch({
                      type: "SET_FIELD",
                      field: "expiresAt",
                      value: addDays(e.target.value, 30),
                    });
                  }}
                  className="w-full rounded-md border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  有効期限
                </label>
                <input
                  type="date"
                  value={state.expiresAt}
                  onChange={(e) =>
                    dispatch({ type: "SET_FIELD", field: "expiresAt", value: e.target.value })
                  }
                  className="w-full rounded-md border border-beige bg-off-white px-3 py-2 text-sm focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                />
              </div>
            </div>

            {/* 案件タイプ */}
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium text-text-secondary">
                案件タイプ（複数選択可）
              </label>
              <div className="flex flex-wrap gap-2">
                {PROJECT_TYPES.map((pt) => {
                  const selected = state.projectTypes.includes(pt.id);
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => {
                        const types = selected
                          ? state.projectTypes.filter((t) => t !== pt.id)
                          : [...state.projectTypes, pt.id];
                        dispatch({ type: "SET_PROJECT_TYPES", types });
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? "bg-navy text-white"
                          : "border border-beige bg-white text-text-secondary hover:bg-off-white"
                      }`}
                    >
                      {pt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ステータス（編集時のみ表示） */}
            {quoteId && (
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  ステータス
                </label>
                <div className="flex gap-2">
                  {Object.entries(QUOTE_STATUSES).map(([key, { label }]) => {
                    const selected = state.status === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => dispatch({ type: "SET_FIELD", field: "status", value: key })}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? "bg-navy text-white"
                            : "border border-beige bg-white text-text-secondary hover:bg-off-white"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 明細テーブル */}
          <section
            id="quote-items"
            className="scroll-mt-6 rounded-lg border border-beige bg-white p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold text-navy">Step 3. 明細（任意で手入力・調整）</h2>
              <button
                type="button"
                onClick={() => dispatch({ type: "ADD_ITEM" })}
                className="rounded-md bg-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-navy/90"
              >
                + 行を追加
              </button>
            </div>

            <div className="overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-beige text-xs text-text-secondary">
                      <th className="w-8 px-1 py-2"></th>
                      <th className="min-w-28 px-1 py-2">カテゴリ</th>
                      <th className="min-w-40 px-1 py-2">品目名</th>
                      <th className="px-1 py-2">単価</th>
                      <th className="px-1 py-2">数量</th>
                      <th className="px-1 py-2">単位</th>
                      <th className="px-1 py-2 text-right">金額</th>
                      <th className="w-8 px-1 py-2"></th>
                    </tr>
                  </thead>
                  <SortableContext
                    items={state.items.map((i) => i.tempId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody>
                      {state.items.map((item) => (
                        <SortableItemRow
                          key={item.tempId}
                          item={item}
                          dispatch={dispatch}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>
            </div>

            {/* 合計エリア */}
            <div className="mt-4 flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">小計（税抜）</span>
                  <span className="font-medium text-navy">
                    ¥{formatCurrency(summary.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">消費税（10%）</span>
                  <span className="font-medium text-navy">
                    ¥{formatCurrency(summary.tax)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-beige pt-1">
                  <span className="font-bold text-navy">合計（税込）</span>
                  <span className="font-bold text-navy">
                    ¥{formatCurrency(summary.total)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 備考・免責事項 */}
          <section
            id="quote-notes"
            className="scroll-mt-6 rounded-lg border border-beige bg-white p-5"
          >
            <h2 className="mb-4 text-sm font-bold text-navy">Step 4. 備考・免責事項</h2>
            <div className="space-y-2">
              {noteGroups.map((group) => {
                const checkedCount = group.notes.filter((n) => n.enabled).length;
                return (
                  <details key={group.groupId} className="group rounded-lg border border-beige/50">
                    <summary className="flex list-none cursor-pointer items-center gap-2 px-3 py-2.5 text-xs font-medium text-navy select-none [&::-webkit-details-marker]:hidden">
                      <svg
                        className="h-3 w-3 shrink-0 text-text-secondary transition-transform duration-200 group-open:rotate-90"
                        viewBox="0 0 12 12"
                        fill="currentColor"
                      >
                        <path d="M4.5 2l4 4-4 4" />
                      </svg>
                      <span>{group.groupLabel}</span>
                      <span className="ml-auto text-[10px] font-normal text-text-secondary">
                        {checkedCount}/{group.notes.length}
                      </span>
                    </summary>
                    <div className="space-y-3 border-t border-beige/30 px-3 pb-3 pt-3">
                      {group.notes.map((note) => (
                        <div key={note.id} className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={note.enabled}
                            onChange={(e) =>
                              dispatch({
                                type: "SET_NOTE_ENABLED",
                                noteId: note.id,
                                enabled: e.target.checked,
                              })
                            }
                            className="mt-1 h-4 w-4 rounded border-beige text-navy focus:ring-green"
                          />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-text-secondary">{note.label}</p>
                            <textarea
                              value={note.text}
                              onChange={(e) =>
                                dispatch({
                                  type: "SET_NOTE_TEXT",
                                  noteId: note.id,
                                  text: e.target.value,
                                })
                              }
                              rows={1}
                              className={`mt-1 w-full rounded border border-beige/50 bg-off-white px-2 py-1 text-xs focus:border-green focus:outline-none ${
                                !note.enabled ? "opacity-40" : ""
                              }`}
                              disabled={!note.enabled}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
