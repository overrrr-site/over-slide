import type { Quote } from "./types";
import { PROJECT_TYPES, SALES_MEMBERS, QUOTE_STATUSES } from "./constants";

/**
 * 見積データをCSV文字列に変換してダウンロードする
 */
export function downloadQuotesCsv(quotes: Quote[]): void {
  const headers = [
    "見積番号",
    "案件名",
    "クライアント名",
    "案件タイプ",
    "売上金額（税抜）",
    "内部人件費",
    "外注費",
    "粗利",
    "粗利率",
    "担当営業",
    "発行日",
    "ステータス",
  ];

  const rows = quotes.map((q) => {
    const typeLabels = (q.project_types || [])
      .map((id) => PROJECT_TYPES.find((pt) => pt.id === id)?.label || id)
      .join("/");

    const salesName =
      SALES_MEMBERS.find((m) => m.id === q.assigned_sales)?.name || q.assigned_sales || "";

    const statusLabel =
      QUOTE_STATUSES[q.status as keyof typeof QUOTE_STATUSES]?.label || q.status;

    // NOTE: 一覧データからは原価情報が取れないため、CSVでの内部人件費・外注費・粗利は
    // quotesテーブルのsubtotalをベースに概算する。
    // 正確な値が必要な場合は、個別の見積詳細APIから取得する必要がある。
    return [
      q.quote_number,
      q.project_name,
      q.client_name,
      typeLabels,
      q.subtotal.toString(),
      "", // 内部人件費（個別取得が必要）
      "", // 外注費（個別取得が必要）
      "", // 粗利（個別取得が必要）
      "", // 粗利率（個別取得が必要）
      salesName,
      q.issued_at,
      statusLabel,
    ];
  });

  const csvContent =
    "\uFEFF" + // BOM for Excel
    [headers, ...rows].map((row) => row.map(escapeCsvField).join(",")).join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `見積一覧_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
