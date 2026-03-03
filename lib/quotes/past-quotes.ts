import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 過去の見積実績をAIコンテキスト用のテキストに変換する。
 * 案件タイプが部分一致するものを最新10件取得。
 */
export async function buildPastQuotesContext(
  supabase: SupabaseClient,
  teamId: string,
  projectTypes: string[]
): Promise<string> {
  // quotes と quote_items を取得
  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, quote_number, client_name, project_name, project_types, subtotal, total, status")
    .eq("team_id", teamId)
    .in("status", ["submitted", "won"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !quotes || quotes.length === 0) {
    return "過去の見積実績はありません。";
  }

  // project_types が部分一致するものをフィルタ
  const filtered = projectTypes.length > 0
    ? quotes.filter((q) => {
        const qTypes = (q.project_types || []) as string[];
        return qTypes.some((t: string) => projectTypes.includes(t));
      })
    : quotes;

  const target = filtered.length > 0 ? filtered.slice(0, 10) : quotes.slice(0, 5);

  // 各見積の明細を取得
  const quoteIds = target.map((q) => q.id);
  const { data: items } = await supabase
    .from("quote_items")
    .select("quote_id, category, name, description, unit_price, quantity, unit, amount")
    .in("quote_id", quoteIds)
    .order("sort_order", { ascending: true });

  const itemsByQuote = new Map<string, typeof items>();
  for (const item of items || []) {
    const existing = itemsByQuote.get(item.quote_id) || [];
    existing.push(item);
    itemsByQuote.set(item.quote_id, existing);
  }

  // テキストに変換
  const lines: string[] = [];
  for (const q of target) {
    lines.push(`---`);
    lines.push(`案件: ${q.project_name} (${q.client_name})`);
    lines.push(`タイプ: ${((q.project_types || []) as string[]).join("、")}`);
    lines.push(`合計: ¥${Number(q.total).toLocaleString()}`);

    const qItems = itemsByQuote.get(q.id) || [];
    if (qItems.length > 0) {
      lines.push(`明細:`);
      for (const item of qItems) {
        const desc = item.description ? ` — ${item.description}` : "";
        lines.push(
          `  - [${item.category}] ${item.name}: ¥${Number(item.unit_price).toLocaleString()} × ${item.quantity}${item.unit} = ¥${Number(item.amount).toLocaleString()}${desc}`
        );
      }
    }
  }

  return lines.join("\n");
}
