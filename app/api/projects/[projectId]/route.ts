import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  // Verify project exists (RLS ensures team-scoped access)
  const { data: project, error: fetchErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();

  if (fetchErr || !project) {
    return NextResponse.json(
      { error: "プロジェクトが見つかりません" },
      { status: 404 }
    );
  }

  // Clean up storage files (best effort, non-blocking)
  try {
    const { data: uploadedFiles } = await supabase
      .from("uploaded_files")
      .select("storage_path")
      .eq("project_id", projectId);

    const { data: generatedFiles } = await supabase
      .from("generated_files")
      .select("storage_path")
      .eq("project_id", projectId);

    const uploadPaths = (uploadedFiles || [])
      .map((f) => f.storage_path)
      .filter(Boolean);
    const genPaths = (generatedFiles || [])
      .map((f) => f.storage_path)
      .filter(Boolean);

    await Promise.allSettled([
      uploadPaths.length > 0
        ? supabase.storage.from("uploads").remove(uploadPaths)
        : Promise.resolve(),
      genPaths.length > 0
        ? supabase.storage.from("generated").remove(genPaths)
        : Promise.resolve(),
    ]);
  } catch {
    // Storage cleanup failure is non-critical
  }

  // Delete project (CASCADE handles all child records)
  const { error: deleteErr } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (deleteErr) {
    console.error("[projects/delete] Error:", deleteErr);
    return NextResponse.json(
      { error: `削除に失敗しました: ${deleteErr.message}` },
      { status: 500 }
    );
  }

  console.log(`[projects/delete] Deleted project ${projectId}`);
  return NextResponse.json({ success: true });
}
