/**
 * Types for docx document generation.
 */

export interface DocxSection {
  /** 見出しレベル (1=章, 2=節, 3=項) */
  level: 1 | 2 | 3;
  /** 見出しテキスト */
  title: string;
  /** 本文（段落テキストまたは箇条書き） */
  body?: string | string[];
  /** 箇条書き（本文とは別に出力される要点リスト） */
  bullets?: string[];
  /** 表データ */
  table?: DocxTableData;
  /** 子セクション */
  children?: DocxSection[];
}

export interface DocxTableData {
  headers: string[];
  rows: string[][];
}

export interface DocumentData {
  /** ドキュメントタイトル */
  title: string;
  /** サブタイトル（任意） */
  subtitle?: string;
  /** セクション一覧 */
  sections: DocxSection[];
}
