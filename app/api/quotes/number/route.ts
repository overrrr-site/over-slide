import { NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { generateQuoteNumber } from "@/lib/quotes/numbering";

export async function GET() {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, profile } = auth;

  const quoteNumber = await generateQuoteNumber(supabase, profile.team_id);

  return NextResponse.json({ quoteNumber });
}
