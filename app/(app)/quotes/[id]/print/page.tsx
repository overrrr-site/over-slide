"use client";

import { Fragment, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Quote, QuoteItem } from "@/lib/quotes/types";
import type { NoteItem } from "@/lib/quotes/types";
import { COMPANY_INFO, PROJECT_TYPES } from "@/lib/quotes/constants";
import { formatCurrency } from "@/lib/quotes/calculations";
import "./print.css";

export default function QuotePrintPage() {
  const params = useParams();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/quotes/${quoteId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setQuote(data.quote);
        setItems(data.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [quoteId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-text-secondary">読み込み中...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-sm text-red-500">見積が見つかりません</p>
      </div>
    );
  }

  const enabledNotes = ((quote.notes || []) as NoteItem[]).filter((n) => n.enabled);

  // カテゴリでグループ化
  const groupedItems: { category: string; items: QuoteItem[] }[] = [];
  let currentCategory = "";
  for (const item of items) {
    if (item.category !== currentCategory) {
      currentCategory = item.category;
      groupedItems.push({ category: currentCategory, items: [] });
    }
    groupedItems[groupedItems.length - 1].items.push(item);
  }

  const projectTypeLabels = (quote.project_types || [])
    .map((id: string) => PROJECT_TYPES.find((pt) => pt.id === id)?.label)
    .filter(Boolean)
    .join("、");

  return (
    <div className="print-page">
      {/* 印刷ボタン（画面表示のみ） */}
      <div className="no-print mb-4 flex items-center justify-between bg-gray-100 p-4">
        <p className="text-sm text-gray-600">
          印刷プレビュー — Ctrl+P（Mac: Cmd+P）で印刷してください
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy/90"
          >
            印刷する
          </button>
          <button
            onClick={() => window.close()}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            閉じる
          </button>
        </div>
      </div>

      {/* PDF本体 */}
      <div className="print-content">
        {/* ヘッダー */}
        <div className="print-header">
          <h1 className="print-title">御見積書</h1>
          <div className="print-meta">
            <p>見積番号: {quote.quote_number}</p>
            <p>発行日: {quote.issued_at}</p>
            <p>有効期限: {quote.expires_at}</p>
          </div>
        </div>

        {/* 宛先と発行者 */}
        <div className="print-parties">
          <div className="print-client">
            <p className="print-client-name">{quote.client_name} 御中</p>
            <p className="print-project-name">件名: {quote.project_name}</p>
            {projectTypeLabels && (
              <p className="print-project-type">（{projectTypeLabels}）</p>
            )}
          </div>
          <div className="print-issuer">
            <div className="print-issuer-inner">
              <div>
                <p className="print-issuer-name">{COMPANY_INFO.name}</p>
                <p>{COMPANY_INFO.zipCode}</p>
                <p>{COMPANY_INFO.address}</p>
                <p>TEL: {COMPANY_INFO.tel}</p>
              </div>
              {/* 印影 */}
              <img
                src="/imprint.png"
                alt="印影"
                className="print-imprint"
              />
            </div>
          </div>
        </div>

        {/* 合計金額（大きく表示） */}
        <div className="print-total-box">
          <span className="print-total-label">お見積金額（税込）</span>
          <span className="print-total-amount">
            ¥{formatCurrency(quote.total)}
          </span>
        </div>

        {/* 明細テーブル */}
        <table className="print-table">
          <thead>
            <tr>
              <th className="print-th" style={{ width: "5%" }}>No.</th>
              <th className="print-th" style={{ width: "35%" }}>品目</th>
              <th className="print-th" style={{ width: "15%" }}>単価</th>
              <th className="print-th" style={{ width: "10%" }}>数量</th>
              <th className="print-th" style={{ width: "10%" }}>単位</th>
              <th className="print-th" style={{ width: "20%" }}>金額</th>
            </tr>
          </thead>
          <tbody>
            {groupedItems.map((group) => (
              <Fragment key={group.category || "uncategorized"}>
                {group.category && (
                  <tr>
                    <td colSpan={6} className="print-category-row">
                      {group.category}
                    </td>
                  </tr>
                )}
                {group.items.map((item) => (
                  <tr key={item.id}>
                    <td className="print-td print-td-center">
                      {items.indexOf(item) + 1}
                    </td>
                    <td className="print-td">
                      {item.name}
                      {item.description && (
                        <div className="text-[10px] text-gray-500 mt-0.5">{item.description}</div>
                      )}
                    </td>
                    <td className="print-td print-td-right">
                      ¥{formatCurrency(item.unit_price)}
                    </td>
                    <td className="print-td print-td-right">{Number(item.quantity)}</td>
                    <td className="print-td print-td-center">{item.unit}</td>
                    <td className="print-td print-td-right">
                      ¥{formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>

        {/* 小計・消費税・合計 */}
        <div className="print-summary">
          <div className="print-summary-row">
            <span>小計（税抜）</span>
            <span>¥{formatCurrency(quote.subtotal)}</span>
          </div>
          <div className="print-summary-row">
            <span>消費税（10%）</span>
            <span>¥{formatCurrency(quote.tax)}</span>
          </div>
          <div className="print-summary-row print-summary-total">
            <span>合計（税込）</span>
            <span>¥{formatCurrency(quote.total)}</span>
          </div>
        </div>

        {/* 備考・免責事項 */}
        {enabledNotes.length > 0 && (
          <div className="print-notes">
            <h3 className="print-notes-title">備考</h3>
            <ul className="print-notes-list">
              {enabledNotes.map((note) => (
                <li key={note.id}>{note.text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
