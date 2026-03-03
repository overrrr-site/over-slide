/**
 * Generic conversation windowing helper to reduce prompt tokens while
 * preserving opening context and recent turns.
 */

export interface HistoryWindowOptions {
  preserveHeadItems?: number;
  maxItems?: number;
  maxTotalChars?: number;
}

/**
 * Keep the first N items and the most recent items under count/char budgets.
 * Always keeps at least the latest item when input is non-empty.
 */
export function windowByText<T>(
  items: T[],
  getText: (item: T) => string,
  options: HistoryWindowOptions = {}
): T[] {
  if (items.length === 0) return [];

  const maxItems = Math.max(1, options.maxItems ?? 24);
  const maxTotalChars = Math.max(1, options.maxTotalChars ?? 20_000);
  const preserveHeadItems = Math.max(0, options.preserveHeadItems ?? 2);

  const totalChars = items.reduce((sum, item) => sum + getText(item).length, 0);
  if (items.length <= maxItems && totalChars <= maxTotalChars) {
    return items;
  }

  const headCount = Math.min(items.length, preserveHeadItems, maxItems);
  const head = items.slice(0, headCount);
  const headChars = head.reduce((sum, item) => sum + getText(item).length, 0);
  const maxTailItems = Math.max(0, maxItems - head.length);

  const tail: T[] = [];
  let tailChars = 0;

  for (let i = items.length - 1; i >= headCount; i -= 1) {
    if (tail.length >= maxTailItems) break;

    const item = items[i];
    const itemChars = getText(item).length;
    const fitsBudget = headChars + tailChars + itemChars <= maxTotalChars;

    // Always keep latest turn even if it alone exceeds budget.
    if (fitsBudget || tail.length === 0) {
      tail.push(item);
      tailChars += itemChars;
    }
  }

  tail.reverse();

  if (tail.length === 0 && head.length === 0) {
    return [items[items.length - 1]];
  }

  return [...head, ...tail];
}
