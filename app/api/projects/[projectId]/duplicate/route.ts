import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, user, profile } = auth;

  // 元のプロジェクトを取得
  const { data: original, error: fetchErr } = await supabase
    .from("projects")
    .select("title, client_name")
    .eq("id", projectId)
    .single();

  if (fetchErr || !original) {
    return NextResponse.json(
      { error: "プロジェクトが見つかりません" },
      { status: 404 }
    );
  }

  // 新しいプロジェクトを作成（ステータスは下書き、ステップは0からスタート）
  const { data: newProject, error: insertErr } = await supabase
    .from("projects")
    .insert({
      team_id: profile.team_id,
      created_by: user.id,
      title: original.title + "（複製）",
      client_name: original.client_name,
      status: "draft",
      current_step: 1,
    })
    .select("id")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: newProject.id });
}
