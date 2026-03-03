"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { UNIT_OPTIONS } from "@/lib/quotes/constants";
import { formatCurrency } from "@/lib/quotes/calculations";
import type { QuoteAction, QuoteItemRow } from "@/lib/quotes/types";

function CurrencyInput({
  value,
  onUpdate,
  placeholder = "0",
  className,
}: {
  value: number;
  onUpdate: (v: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState("");

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setEditing(true);
    setLocalValue(value ? String(value) : "");
    setTimeout(() => e.target.select(), 0);
  };

  const handleBlur = () => {
    setEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalValue(raw);
    const num = parseInt(raw.replace(/[^0-9]/g, ""), 10) || 0;
    onUpdate(num);
  };

  const displayValue = editing ? localValue : value ? formatCurrency(value) : "";

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
}

export function SortableItemRow({
  item,
  dispatch,
}: {
  item: QuoteItemRow;
  dispatch: React.Dispatch<QuoteAction>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.tempId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const updateField = (field: keyof QuoteItemRow, value: unknown) => {
    dispatch({ type: "UPDATE_ITEM", tempId: item.tempId, field, value });
  };

  return (
    <>
      <tr ref={setNodeRef} style={style}>
        <td className="px-1 pt-1.5 pb-0.5">
          <button
            type="button"
            className="cursor-grab px-1 text-text-secondary hover:text-navy"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
        </td>
        <td className="px-1 pt-1.5 pb-0.5">
          <input
            type="text"
            value={item.category}
            onChange={(e) => updateField("category", e.target.value)}
            placeholder="カテゴリ"
            className="w-full rounded border border-beige/50 bg-off-white px-2 py-1 text-xs focus:border-green focus:outline-none"
          />
        </td>
        <td className="px-1 pt-1.5 pb-0.5">
          <input
            type="text"
            value={item.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="品目名"
            className="w-full rounded border border-beige/50 bg-off-white px-2 py-1 text-xs focus:border-green focus:outline-none"
          />
        </td>
        <td className="px-1 pt-1.5 pb-0.5">
          <CurrencyInput
            value={item.unitPrice}
            onUpdate={(v) => updateField("unitPrice", v)}
            className="w-24 rounded border border-beige/50 bg-off-white px-2 py-1 text-right text-xs focus:border-green focus:outline-none"
          />
        </td>
        <td className="px-1 pt-1.5 pb-0.5">
          <input
            type="number"
            value={item.quantity || ""}
            onChange={(e) => updateField("quantity", Number(e.target.value))}
            step="0.5"
            min="0"
            className="w-16 rounded border border-beige/50 bg-off-white px-2 py-1 text-right text-xs focus:border-green focus:outline-none"
          />
        </td>
        <td className="px-1 pt-1.5 pb-0.5">
          <select
            value={item.unit}
            onChange={(e) => updateField("unit", e.target.value)}
            className="rounded border border-beige/50 bg-off-white px-1 py-1 text-xs focus:border-green focus:outline-none"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </td>
        <td className="px-1 pt-1.5 pb-0.5 text-right text-xs font-medium text-navy">
          ¥{formatCurrency(item.amount)}
        </td>
        <td className="px-1 pt-1.5 pb-0.5">
          <button
            type="button"
            onClick={() => dispatch({ type: "REMOVE_ITEM", tempId: item.tempId })}
            className="rounded p-1 text-text-secondary hover:bg-red-50 hover:text-red-500"
            title="行を削除"
          >
            ✕
          </button>
        </td>
      </tr>
      <tr style={style} className="border-b border-beige/50">
        <td></td>
        <td colSpan={7} className="px-1 pb-1.5">
          <input
            type="text"
            value={item.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="品目の詳細内容を入力..."
            className="w-full rounded border border-beige/30 bg-off-white/50 px-2 py-0.5 text-[11px] text-text-secondary placeholder:text-text-secondary/30 focus:border-green focus:outline-none"
          />
        </td>
      </tr>
    </>
  );
}
