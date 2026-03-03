import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { parseJsonWithSchema } from "@/lib/api/validation";
import {
  buildQuoteItemRows,
  buildQuoteRecordPayload,
} from "@/lib/quotes/persistence";
import { quoteUpsertRequestSchema } from "@/lib/quotes/schemas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabase
    .from("quote_items")
    .select("*")
    .eq("quote_id", id)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({ quote, items });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  let body;
  try {
    body = await parseJsonWithSchema(request, quoteUpsertRequestSchema);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  // 見積ヘッダーを更新
  const { error: quoteError } = await supabase
    .from("quotes")
    .update({
      ...buildQuoteRecordPayload(body),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 });
  }

  // 明細行を全削除 + 全挿入（シンプルで安全）
  const { error: deleteError } = await supabase
    .from("quote_items")
    .delete()
    .eq("quote_id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const itemRows = buildQuoteItemRows(id, body.items);
  if (itemRows.length > 0) {

    const { error: insertError } = await supabase
      .from("quote_items")
      .insert(itemRows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  const { error } = await supabase.from("quotes").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
