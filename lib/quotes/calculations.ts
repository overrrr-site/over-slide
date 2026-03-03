import type { QuoteItemRow } from "./types";
import { TAX_RATE } from "./constants";

/**
 * 行の金額を計算（単価 × 数量、円未満切り捨て）
 */
export function calcItemAmount(unitPrice: number, quantity: number): number {
  return Math.floor(unitPrice * quantity);
}

/**
 * 小計（税抜）を計算
 */
export function calcSubtotal(items: QuoteItemRow[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/**
 * 消費税を計算（円未満切り捨て）
 */
export function calcTax(subtotal: number): number {
  return Math.floor(subtotal * TAX_RATE);
}

/**
 * 合計（税込）を計算
 */
export function calcTotal(subtotal: number, tax: number): number {
  return subtotal + tax;
}

/**
 * 数値を日本円フォーマットに変換
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString("ja-JP");
}
