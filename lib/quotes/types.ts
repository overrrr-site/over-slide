// ============================================================
// 見積ツール 型定義
// ============================================================

export type QuoteStatus = "draft" | "submitted" | "won" | "lost";

// --- DB レコード型 ---

export type Quote = {
  id: string;
  team_id: string;
  created_by: string;
  origin_brainstorm_id: string | null;
  orient_sheet_markdown: string;
  quote_number: string;
  client_name: string;
  project_name: string;
  project_types: string[];
  status: QuoteStatus;
  issued_at: string;
  expires_at: string;
  subtotal: number;
  tax: number;
  total: number;
  notes: NoteItem[];
  assigned_sales: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  sort_order: number;
  category: string;
  name: string;
  description: string;
  unit_price: number;
  quantity: number;
  unit: string;
  amount: number;
};

// --- フォーム用型 ---

export type NoteItem = {
  id: string;
  label: string;
  text: string;
  enabled: boolean;
};

export type QuoteItemRow = {
  tempId: string;
  id?: string;
  sortOrder: number;
  category: string;
  name: string;
  description: string;
  unitPrice: number;
  quantity: number;
  unit: string;
  amount: number;
};

export type QuoteFormState = {
  projectName: string;
  clientName: string;
  originBrainstormId: string;
  orientSheetMarkdown: string;
  quoteNumber: string;
  issuedAt: string;
  expiresAt: string;
  projectTypes: string[];
  assignedSales: string;
  status: QuoteStatus;
  items: QuoteItemRow[];
  notes: NoteItem[];
  saving: boolean;
  lastSavedAt: string | null;
  isDirty: boolean;
};

// --- Reducer Action 型 ---

export type QuoteAction =
  | { type: "SET_FIELD"; field: keyof QuoteFormState; value: unknown }
  | { type: "SET_PROJECT_TYPES"; types: string[] }
  | { type: "ADD_ITEM"; item?: Partial<QuoteItemRow> }
  | { type: "UPDATE_ITEM"; tempId: string; field: keyof QuoteItemRow; value: unknown }
  | { type: "REMOVE_ITEM"; tempId: string }
  | { type: "REORDER_ITEMS"; items: QuoteItemRow[] }
  | { type: "SET_NOTE_ENABLED"; noteId: string; enabled: boolean }
  | { type: "SET_NOTE_TEXT"; noteId: string; text: string }
  | { type: "LOAD_QUOTE"; quote: Quote; items: QuoteItem[] }
  | { type: "SET_SAVING"; saving: boolean }
  | { type: "MARK_SAVED" }
  | { type: "ADD_SUGGESTED_ITEMS"; items: Partial<QuoteItemRow>[] };

export type ProjectTypeConfig = {
  id: string;
  label: string;
};
