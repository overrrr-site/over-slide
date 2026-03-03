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
  const brainstormId = formData.get("brainstormId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (!brainstormId) {
    return NextResponse.json({ error: "brainstormId is required" }, { status: 400 });
  }

  const { data: brainstorm } = await supabase
    .from("brainstorm_sessions")
    .select("id")
    .eq("id", brainstormId)
    .single();

  if (!brainstorm) {
    return NextResponse.json({ error: "Brainstorm not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = buildTimestampStoragePath(
    `${profile.team_id}/brainstorms/uploads/${brainstormId}`,
    file.name
  );

  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(storagePath, buffer, {
      contentType: file.type,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  let extractedText = "";
  try {
    extractedText = await extractText(buffer, file.name);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Text extraction failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data: doc, error: dbError } = await supabase
    .from("brainstorm_uploaded_files")
    .insert({
      brainstorm_id: brainstormId,
      team_id: profile.team_id,
      uploaded_by: user.id,
      file_name: file.name,
      file_type: inferDocumentType(file.name),
      file_size: file.size,
      storage_path: storagePath,
      extracted_text: extractedText,
    })
    .select("id, file_name")
    .single();

  if (dbError) {
    return NextResponse.json({ error: `DB save failed: ${dbError.message}` }, { status: 500 });
  }

  await supabase
    .from("brainstorm_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", brainstormId);

  return NextResponse.json({
    id: doc.id,
    fileName: doc.file_name,
    extractedTextLength: extractedText.length,
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) return auth;
  const { supabase } = auth;

  const { fileId } = await request.json();

  if (!fileId) {
    return NextResponse.json({ error: "fileId is required" }, { status: 400 });
  }

  const { data: file } = await supabase
    .from("brainstorm_uploaded_files")
    .select("storage_path, brainstorm_id")
    .eq("id", fileId)
    .single();

  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  await supabase.storage.from("uploads").remove([file.storage_path]);

  const { error: dbError } = await supabase
    .from("brainstorm_uploaded_files")
    .delete()
    .eq("id", fileId);

  if (dbError) {
    return NextResponse.json({ error: `Delete failed: ${dbError.message}` }, { status: 500 });
  }

  await supabase
    .from("brainstorm_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", file.brainstorm_id);

  return NextResponse.json({ success: true });
}
