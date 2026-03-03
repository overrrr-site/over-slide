import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";

function migrationHint(error: unknown): string | null {
  const err = error as { code?: string; message?: string } | null;
  if (!err) return null;
  if (err.code === "42P01") {
    return "DB migration未適用です。supabase/migrations/00015_brainstorms.sql を適用してください。";
  }
  if (typeof err.message === "string" && err.message.includes("brainstorm_sessions")) {
    return "brainstorm_sessions テーブルが見つかりません。00015_brainstorms.sql を適用してください。";
  }
  return null;
}

export async function GET() {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("brainstorm_sessions")
    .select("id, title, client_name, status, brief_tone, updated_at, created_at")
    .order("updated_at", { ascending: false });

  if (error) {
    const hint = migrationHint(error);
    if (hint) {
      return NextResponse.json({ error: hint }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, user, profile } = auth;

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" && body.title.trim()
    ? body.title.trim()
    : "新しいブレスト";
  const clientName = typeof body.clientName === "string" ? body.clientName.trim() : "";

  const { data, error } = await supabase
    .from("brainstorm_sessions")
    .insert({
      team_id: profile.team_id,
      created_by: user.id,
      title,
      client_name: clientName,
      status: "active",
      brief_tone: "hybrid",
    })
    .select("id")
    .single();

  if (error) {
    const hint = migrationHint(error);
    if (hint) {
      return NextResponse.json({ error: hint }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
