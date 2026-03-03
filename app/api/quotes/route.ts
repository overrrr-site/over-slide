import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { parseJsonWithSchema } from "@/lib/api/validation";
import {
  buildQuoteItemRows,
  buildQuoteRecordPayload,
} from "@/lib/quotes/persistence";
import { quoteUpsertRequestSchema } from "@/lib/quotes/schemas";

export async function GET() {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, user, profile } = auth;

  let body;
  try {
    body = await parseJsonWithSchema(request, quoteUpsertRequestSchema);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  // 見積ヘッダーを挿入
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      team_id: profile.team_id,
      created_by: user.id,
      ...buildQuoteRecordPayload(body),
    })
    .select("id")
    .single();

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 });
  }

  // 明細行を挿入
  const itemRows = buildQuoteItemRows(quote.id, body.items);
  if (itemRows.length > 0) {

    const { error: itemsError } = await supabase
      .from("quote_items")
      .insert(itemRows);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: quote.id });
}
