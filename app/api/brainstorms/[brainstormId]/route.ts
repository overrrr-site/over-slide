import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { buildBriefSheetMarkdown } from "@/lib/brief-sheet/format";

const VALID_STATUS = new Set(["active", "completed", "archived"]);
const VALID_TONES = new Set(["logical", "emotional", "hybrid"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ brainstormId: string }> }
) {
  const { brainstormId } = await params;
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  const [{ data: session, error: sessionError }, { data: exports }, { data: projects }, { data: uploadedFiles }] = await Promise.all([
    supabase
      .from("brainstorm_sessions")
      .select("id, title, client_name, status, brief_tone, client_info, background, hypothesis, goal, constraints, research_topics, structure_draft, raw_markdown, chat_history, created_at, updated_at")
      .eq("id", brainstormId)
      .single(),
    supabase
      .from("brainstorm_exports")
      .select("id, file_type, created_at")
      .eq("brainstorm_id", brainstormId)
      .order("created_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, title, output_type, created_at")
      .eq("origin_brainstorm_id", brainstormId)
      .order("created_at", { ascending: false }),
    supabase
      .from("brainstorm_uploaded_files")
      .select("id, file_name")
      .eq("brainstorm_id", brainstormId)
      .order("created_at", { ascending: true }),
  ]);

  if (sessionError || !session) {
    return NextResponse.json({ error: "Brainstorm not found" }, { status: 404 });
  }

  return NextResponse.json({
    session,
    exports: exports || [],
    projects: projects || [],
    uploadedFiles: uploadedFiles || [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brainstormId: string }> }
) {
  const { brainstormId } = await params;
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  const body = await request.json().catch(() => ({}));

  const { data: current } = await supabase
    .from("brainstorm_sessions")
    .select("id, client_info, background, hypothesis, goal, constraints, research_topics, structure_draft")
    .eq("id", brainstormId)
    .single();

  if (!current) {
    return NextResponse.json({ error: "Brainstorm not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.title === "string") patch.title = body.title.trim() || "新しいブレスト";
  if (typeof body.client_name === "string") patch.client_name = body.client_name.trim();
  if (typeof body.status === "string" && VALID_STATUS.has(body.status)) patch.status = body.status;
  if (typeof body.brief_tone === "string" && VALID_TONES.has(body.brief_tone)) patch.brief_tone = body.brief_tone;

  const briefKeys = [
    "client_info",
    "background",
    "hypothesis",
    "goal",
    "constraints",
    "research_topics",
    "structure_draft",
  ] as const;

  let hasBriefFieldUpdate = false;
  for (const key of briefKeys) {
    if (typeof body[key] === "string") {
      patch[key] = body[key].trim();
      hasBriefFieldUpdate = true;
    }
  }

  if (hasBriefFieldUpdate) {
    patch.raw_markdown = buildBriefSheetMarkdown({
      client_info: (patch.client_info as string) ?? current.client_info ?? "",
      background: (patch.background as string) ?? current.background ?? "",
      hypothesis: (patch.hypothesis as string) ?? current.hypothesis ?? "",
      goal: (patch.goal as string) ?? current.goal ?? "",
      constraints: (patch.constraints as string) ?? current.constraints ?? "",
      research_topics: (patch.research_topics as string) ?? current.research_topics ?? "",
      structure_draft: (patch.structure_draft as string) ?? current.structure_draft ?? "",
    });
  }

  if (Object.keys(patch).length === 0) {
    const { data: session } = await supabase
      .from("brainstorm_sessions")
      .select("*")
      .eq("id", brainstormId)
      .single();
    return NextResponse.json({ session });
  }
  patch.updated_at = new Date().toISOString();

  const { data: session, error } = await supabase
    .from("brainstorm_sessions")
    .update(patch)
    .eq("id", brainstormId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ brainstormId: string }> }
) {
  const { brainstormId } = await params;
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  // セッション存在確認
  const { data: session, error: fetchErr } = await supabase
    .from("brainstorm_sessions")
    .select("id")
    .eq("id", brainstormId)
    .single();

  if (fetchErr || !session) {
    return NextResponse.json(
      { error: "ブレストが見つかりません" },
      { status: 404 }
    );
  }

  // ストレージのアップロードファイルを削除（ベストエフォート）
  try {
    const { data: uploadedFiles } = await supabase
      .from("brainstorm_uploaded_files")
      .select("storage_path")
      .eq("brainstorm_id", brainstormId);

    const paths = (uploadedFiles || [])
      .map((f) => f.storage_path)
      .filter(Boolean);

    if (paths.length > 0) {
      await supabase.storage.from("uploads").remove(paths);
    }
  } catch {
    // ストレージ削除失敗は致命的でない
  }

  // セッション削除（CASCADE で exports, uploaded_files も消える）
  const { error: deleteErr } = await supabase
    .from("brainstorm_sessions")
    .delete()
    .eq("id", brainstormId);

  if (deleteErr) {
    console.error("[brainstorms/delete] Error:", deleteErr);
    return NextResponse.json(
      { error: `削除に失敗しました: ${deleteErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
