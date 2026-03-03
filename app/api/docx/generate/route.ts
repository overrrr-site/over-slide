import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { generateDocx } from "@/lib/docx/generator";
import type { DocumentData } from "@/lib/docx/types";

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, profile } = auth;

  const body = await request.json();
  const { projectId, documentData } = body as {
    projectId: string;
    documentData: DocumentData;
  };

  if (!projectId || !documentData) {
    return NextResponse.json(
      { error: "projectId and documentData are required" },
      { status: 400 }
    );
  }

  // Verify project belongs to user's team
  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const buffer = await generateDocx(documentData);

    // Upload to Supabase Storage
    const fileName = `${profile.team_id}/${projectId}/${Date.now()}.docx`;
    const { error: uploadError } = await supabase.storage
      .from("generated")
      .upload(fileName, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Save record to generated_files
    const { data: genFile, error: dbError } = await supabase
      .from("generated_files")
      .insert({
        project_id: projectId,
        file_type: "docx",
        storage_path: fileName,
        slide_data: documentData,
      })
      .select("id")
      .single();

    if (dbError) {
      return NextResponse.json(
        { error: `DB save failed: ${dbError.message}` },
        { status: 500 }
      );
    }

    // ダウンロードURLはlocalhostプロキシ経由（プレビューツール対応）
    return NextResponse.json({
      id: genFile.id,
      downloadUrl: `/api/docx/download?id=${genFile.id}`,
      storagePath: fileName,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "DOCX generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
