import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { generateQuoteNumber } from "@/lib/quotes/numbering";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, user, profile } = auth;

  // 元の見積を取得
  const { data: original, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (quoteError || !original) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // 元の明細を取得
  const { data: originalItems } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", id)
    .order("sort_order", { ascending: true });

  const today = new Date();
  const todayStr = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
  const newQuoteNumber = await generateQuoteNumber(
    supabase,
    profile.team_id,
    todayStr
  );

  // 新しい見積を挿入（ステータスは下書きにリセット）
  const { data: newQuote, error: insertError } = await supabase
    .from("quotes")
    .insert({
      team_id: profile.team_id,
      created_by: user.id,
      origin_brainstorm_id: original.origin_brainstorm_id || null,
      orient_sheet_markdown: original.orient_sheet_markdown || "",
      quote_number: newQuoteNumber,
      client_name: original.client_name,
      project_name: original.project_name + "（複製）",
      project_types: original.project_types,
      status: "draft",
      issued_at: today.toISOString().split("T")[0],
      expires_at: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      subtotal: original.subtotal,
      tax: original.tax,
      total: original.total,
      notes: original.notes,
      assigned_sales: original.assigned_sales,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 明細を複製
  if (originalItems && originalItems.length > 0) {
    const itemRows = originalItems.map((item) => ({
      quote_id: newQuote.id,
      sort_order: item.sort_order,
      category: item.category,
      name: item.name,
      description: item.description || "",
      unit_price: item.unit_price,
      quantity: item.quantity,
      unit: item.unit,
      amount: item.amount,
    }));

    const { error: itemsError } = await supabase
      .from("quote_items")
      .insert(itemRows);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: newQuote.id });
}
