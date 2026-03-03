import type {
  QuoteWorkspaceItem,
  QuoteWorkspaceReferenceMaterial,
} from "@/lib/quotes/workspace-schema";

const PROJECT_TYPE_GUIDE = [
  "web: Webサイト制作",
  "video: 動画制作",
  "graphic: グラフィック制作",
  "print: 印刷物制作",
  "content: 記事・コンテンツ制作",
  "casting: キャスティング",
  "event: イベント企画・実施",
  "advertising: 広告代理",
  "consulting: コンサルテーション",
  "research: 調査企画・実施",
  "other: その他",
].join("\n");

function formatItems(items: QuoteWorkspaceItem[]): string {
  if (items.length === 0) return "（なし）";

  return items
    .map((item) => {
      const desc = item.description ? ` / ${item.description}` : "";
      return `- [${item.category}] ${item.name}${desc} / ¥${item.unitPrice.toLocaleString()} × ${item.quantity}${item.unit}`;
    })
    .join("\n");
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...[省略]`;
}

function formatReferenceMaterials(
  materials: QuoteWorkspaceReferenceMaterial[]
): string {
  if (materials.length === 0) return "（なし）";

  return materials
    .slice(0, 4)
    .map((material, index) => {
      const label = material.title || `資料${index + 1}`;
      const typeLabel = material.fileType ? material.fileType.toUpperCase() : "DOC";
      const body = truncateText(material.text || "", 6_000) || "（本文なし）";
      return `### ${label} [${typeLabel}]\n${body}`;
    })
    .join("\n\n");
}

export function buildQuoteWorkspaceInitialPrompt(
  pastQuotesContext: string,
  orientSheetMarkdown: string,
  referenceMaterials: QuoteWorkspaceReferenceMaterial[],
  currentProjectTypes: string[],
  currentItems: QuoteWorkspaceItem[]
): string {
  return [
    "あなたはOVER株式会社の見積設計AIです。",
    "オリエンシートを起点に、初回の見積明細案を作成してください。",
    "",
    "## タスク",
    "1. オリエンシートを読み、必要な作業を漏れなく明細化する",
    "2. suggestedProjectTypes に適切な案件タイプIDを1〜3件提案する",
    "3. 一致が弱い/不明確な場合は suggestedProjectTypes に必ず other を含める",
    "4. confidence は 0.00〜1.00 の範囲で出す（低一致なら0.45以下）",
    "5. rationale は提案根拠を1〜3文で示す",
    "",
    "## 案件タイプID一覧",
    PROJECT_TYPE_GUIDE,
    "",
    "## 出力ルール",
    "- items は category/name/description/unitPrice/quantity/unit を必須で返す",
    "- 単価は整数（円）、quantity は0以上",
    "- 既存明細と同じ category+name は重複提案しない",
    "- 回答はJSONオブジェクトのみ（説明文は出力しない）",
    "",
    "## オリエンシート",
    orientSheetMarkdown.trim() || "（未入力）",
    "",
    "## 参照資料（PDF/DOCX 抽出テキスト）",
    formatReferenceMaterials(referenceMaterials),
    "",
    "## 現在の案件タイプ",
    currentProjectTypes.join(", ") || "（未選択）",
    "",
    "## 現在の明細",
    formatItems(currentItems),
    "",
    "## 過去見積コンテキスト",
    pastQuotesContext,
  ].join("\n");
}

export function buildQuoteWorkspaceRevisePrompt(
  pastQuotesContext: string,
  orientSheetMarkdown: string,
  referenceMaterials: QuoteWorkspaceReferenceMaterial[],
  instruction: string,
  currentProjectTypes: string[],
  baseItems: QuoteWorkspaceItem[],
  currentItems: QuoteWorkspaceItem[]
): string {
  return [
    "あなたはOVER株式会社の見積設計AIです。",
    "既存の見積案をユーザー指示に合わせて更新してください。",
    "",
    "## タスク",
    "1. ユーザー指示を反映し、明細案を全体として再構成する",
    "2. オリエンシートと矛盾する変更は避ける",
    "3. suggestedProjectTypes は必要な場合のみ更新（不確実ならotherを含める）",
    "4. rationale は変更理由を1〜3文で要約する",
    "",
    "## 案件タイプID一覧",
    PROJECT_TYPE_GUIDE,
    "",
    "## 出力ルール",
    "- items は最終版の全明細を返す（差分だけではなく全体）",
    "- 回答はJSONオブジェクトのみ（説明文は出力しない）",
    "",
    "## オリエンシート",
    orientSheetMarkdown.trim() || "（未入力）",
    "",
    "## 参照資料（PDF/DOCX 抽出テキスト）",
    formatReferenceMaterials(referenceMaterials),
    "",
    "## ユーザー指示",
    instruction.trim() || "（指示なし）",
    "",
    "## 現在の案件タイプ",
    currentProjectTypes.join(", ") || "（未選択）",
    "",
    "## 修正前のドラフト明細",
    formatItems(baseItems),
    "",
    "## 既存フォーム明細",
    formatItems(currentItems),
    "",
    "## 過去見積コンテキスト",
    pastQuotesContext,
  ].join("\n");
}
