// OVER Inc. Brand Colors (hex without #)
export const COLORS = {
  navy: "1A2B4A",
  green: "6B8E7F",
  beige: "E8D5C4",
  offWhite: "F9F7F4",
  textPrimary: "2A2A2A",
  textSecondary: "666666",
  white: "FFFFFF",
} as const;

// OVER Inc. Font System
export const FONTS = {
  jp: "Zen Kaku Gothic New",
  en: "Montserrat",
  fallback: "Arial",
} as const;

// Slide typography mapping (requirements.md §3.3)
export const TYPOGRAPHY = {
  coverTitle: { font: FONTS.jp, size: 36, bold: false, color: COLORS.white },
  coverSubtitle: { font: FONTS.jp, size: 18, bold: false, color: COLORS.offWhite },
  sectionTitle: { font: FONTS.jp, size: 32, bold: false, color: COLORS.white },
  slideTitle: { font: FONTS.jp, size: 22, bold: true, color: COLORS.navy },
  bodyText: { font: FONTS.jp, size: 14, bold: false, color: COLORS.textPrimary },
  caption: { font: FONTS.jp, size: 12, bold: false, color: COLORS.textSecondary },
  kpiValue: { font: FONTS.en, size: 40, bold: true, color: COLORS.navy },
  kpiLabel: { font: FONTS.jp, size: 12, bold: false, color: COLORS.textPrimary },
  tableHeader: { font: FONTS.jp, size: 12, bold: true, color: COLORS.white },
  tableBody: { font: FONTS.jp, size: 11, bold: false, color: COLORS.textPrimary },
  slideNumber: { font: FONTS.en, size: 10, bold: false, color: COLORS.textSecondary },
  confidential: { font: FONTS.en, size: 10, bold: false, color: COLORS.textSecondary },
} as const;

// Master Slide names
export const MASTER_SLIDES = [
  "COVER",
  "SECTION",
  "CONTENT_1COL",
  "CONTENT_2COL",
  "CONTENT_VISUAL",
  "DATA_HIGHLIGHT",
  "CLOSING",
] as const;

export type MasterSlideName = (typeof MASTER_SLIDES)[number];

// Workflow steps for proposal projects (discussion moved to independent brainstorm)
export const WORKFLOW_STEPS = [
  { id: 1, name: "リサーチ", path: "research" },
  { id: 2, name: "構成作成", path: "structure" },
  { id: 3, name: "詳細作成", path: "details" },
  { id: 4, name: "内容レビュー", path: "content-review" },
  { id: 5, name: "デザイン化", path: "design" },
  { id: 6, name: "最終レビュー", path: "design-review" },
] as const;

/** ドキュメントモードで変わるステップ名（id をキーに上書き） */
export const DOCUMENT_STEP_NAMES: Partial<Record<number, string>> = {
  5: "文書生成",
};

/** output_type に応じたワークフローステップを返す */
export function getWorkflowSteps(outputType?: string) {
  if (outputType === "document") {
    // ドキュメントは5ステップ（最終レビューをスキップ）
    return WORKFLOW_STEPS.filter((s) => s.id <= 5);
  }
  return [...WORKFLOW_STEPS];
}

// Project statuses
export const PROJECT_STATUSES = [
  "draft",
  "in_progress",
  "review",
  "completed",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
