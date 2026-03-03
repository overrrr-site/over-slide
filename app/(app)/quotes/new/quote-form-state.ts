import type {
  NoteItem,
  Quote,
  QuoteAction,
  QuoteFormState,
  QuoteItem,
  QuoteItemRow,
} from "@/lib/quotes/types";
import { generateNotesForTypes } from "@/lib/quotes/constants";
import { calcItemAmount } from "@/lib/quotes/calculations";

function generateTempId(): string {
  return crypto.randomUUID();
}

export function createEmptyItem(sortOrder: number): QuoteItemRow {
  return {
    tempId: generateTempId(),
    sortOrder,
    category: "",
    name: "",
    description: "",
    unitPrice: 0,
    quantity: 1,
    unit: "式",
    amount: 0,
  };
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function quoteReducer(state: QuoteFormState, action: QuoteAction): QuoteFormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value, isDirty: true };

    case "SET_PROJECT_TYPES": {
      const notes = generateNotesForTypes(action.types);
      return { ...state, projectTypes: action.types, notes, isDirty: true };
    }

    case "ADD_ITEM": {
      const newItem: QuoteItemRow = {
        ...createEmptyItem(state.items.length),
        ...action.item,
        tempId: generateTempId(),
      };
      if (action.item?.unitPrice && action.item?.quantity) {
        newItem.amount = calcItemAmount(action.item.unitPrice, action.item.quantity);
      }
      return { ...state, items: [...state.items, newItem], isDirty: true };
    }

    case "UPDATE_ITEM": {
      const items = state.items.map((item) => {
        if (item.tempId !== action.tempId) return item;
        const updated = { ...item, [action.field]: action.value };
        if (action.field === "unitPrice" || action.field === "quantity") {
          updated.amount = calcItemAmount(updated.unitPrice, updated.quantity);
        }
        return updated;
      });
      return { ...state, items, isDirty: true };
    }

    case "REMOVE_ITEM": {
      const items = state.items
        .filter((item) => item.tempId !== action.tempId)
        .map((item, i) => ({ ...item, sortOrder: i }));
      return { ...state, items, isDirty: true };
    }

    case "REORDER_ITEMS":
      return {
        ...state,
        items: action.items.map((item, i) => ({ ...item, sortOrder: i })),
        isDirty: true,
      };

    case "SET_NOTE_ENABLED": {
      const notes = state.notes.map((n) =>
        n.id === action.noteId ? { ...n, enabled: action.enabled } : n
      );
      return { ...state, notes, isDirty: true };
    }

    case "SET_NOTE_TEXT": {
      const notes = state.notes.map((n) =>
        n.id === action.noteId ? { ...n, text: action.text } : n
      );
      return { ...state, notes, isDirty: true };
    }

    case "LOAD_QUOTE": {
      const q = action.quote as Quote;
      const items: QuoteItemRow[] = (action.items as QuoteItem[]).map((item) => ({
        tempId: generateTempId(),
        id: item.id,
        sortOrder: item.sort_order,
        category: item.category,
        name: item.name,
        description: item.description || "",
        unitPrice: item.unit_price,
        quantity: Number(item.quantity),
        unit: item.unit,
        amount: item.amount,
      }));
      return {
        projectName: q.project_name,
        clientName: q.client_name,
        originBrainstormId: q.origin_brainstorm_id || "",
        orientSheetMarkdown: q.orient_sheet_markdown || "",
        quoteNumber: q.quote_number,
        issuedAt: q.issued_at,
        expiresAt: q.expires_at,
        projectTypes: q.project_types || [],
        assignedSales: q.assigned_sales || "",
        status: q.status,
        items,
        notes: (q.notes as NoteItem[]) || generateNotesForTypes(q.project_types || []),
        saving: false,
        lastSavedAt: q.updated_at,
        isDirty: false,
      };
    }

    case "SET_SAVING":
      return { ...state, saving: action.saving };

    case "MARK_SAVED":
      return {
        ...state,
        saving: false,
        isDirty: false,
        lastSavedAt: new Date().toISOString(),
      };

    case "ADD_SUGGESTED_ITEMS": {
      const newItems = action.items.map((partial, i) => ({
        ...createEmptyItem(state.items.length + i),
        ...partial,
        tempId: generateTempId(),
        amount: calcItemAmount(partial.unitPrice || 0, partial.quantity || 1),
      }));
      return { ...state, items: [...state.items, ...newItems], isDirty: true };
    }

    default:
      return state;
  }
}

export function createInitialState(): QuoteFormState {
  const today = todayStr();
  return {
    projectName: "",
    clientName: "",
    originBrainstormId: "",
    orientSheetMarkdown: "",
    quoteNumber: "",
    issuedAt: today,
    expiresAt: addDays(today, 30),
    projectTypes: [],
    assignedSales: "",
    status: "draft",
    items: [createEmptyItem(0)],
    notes: generateNotesForTypes([]),
    saving: false,
    lastSavedAt: null,
    isDirty: false,
  };
}
