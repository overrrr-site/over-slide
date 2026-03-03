import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { extractText } from "@/lib/files/extractors";
import {
  buildTimestampStoragePath,
  inferDocumentType,
} from "@/lib/files/upload-utils";

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) return auth;
  const { supabase, user, profile } = auth;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("projectId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  // プロジェクトの存在確認
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // ストレージパス: チームID/discussion/タイムスタンプ.拡張子
  const storagePath = buildTimestampStoragePath(
    `${profile.team_id}/discussion`,
    file.name
  );

  // Supabase Storage にアップロード
  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(storagePath, buffer, {
      contentType: file.type,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // テキスト抽出
  let extractedText = "";
  try {
    extractedText = await extractText(buffer, file.name);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Text extraction failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // uploaded_files テーブルに保存
  const { data: doc, error: dbError } = await supabase
    .from("uploaded_files")
    .insert({
      project_id: projectId,
      team_id: profile.team_id,
      uploaded_by: user.id,
      file_name: file.name,
      file_type: inferDocumentType(file.name),
      file_size: file.size,
      storage_path: storagePath,
      extracted_text: extractedText,
      purpose: "discussion",
    })
    .select("id, file_name")
    .single();

  if (dbError) {
    return NextResponse.json(
      { error: `DB save failed: ${dbError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: doc.id,
    fileName: doc.file_name,
    extractedTextLength: extractedText.length,
  });
}

/**
 * DELETE: 与件資料を削除する
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const { fileId } = await request.json();

  if (!fileId) {
    return NextResponse.json(
      { error: "fileId is required" },
      { status: 400 }
    );
  }

  // ファイルのストレージパスを取得
  const { data: file } = await supabase
    .from("uploaded_files")
    .select("storage_path")
    .eq("id", fileId)
    .single();

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // ストレージから削除
  await supabase.storage.from("uploads").remove([file.storage_path]);

  // DBから削除
  const { error: dbError } = await supabase
    .from("uploaded_files")
    .delete()
    .eq("id", fileId);

  if (dbError) {
    return NextResponse.json(
      { error: `Delete failed: ${dbError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
