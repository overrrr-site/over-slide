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
  const title = (formData.get("title") as string) || "";
  const purpose = (formData.get("purpose") as string) || "style"; // "style" | "content"
  const tags = formData.get("tags") as string; // JSON array

  if (!file) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  // purpose のバリデーション
  if (!["style", "content"].includes(purpose)) {
    return NextResponse.json(
      { error: "purpose must be 'style' or 'content'" },
      { status: 400 }
    );
  }

  let buffer: Buffer | null = Buffer.from(await file.arrayBuffer());

  // Storage key: use timestamp + extension only (no Japanese chars)
  // Original filename is preserved in knowledge_docs.file_name
  const storagePath = buildTimestampStoragePath(
    `${profile.team_id}/knowledge`,
    file.name
  );

  // Upload to Supabase Storage
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

  // Extract text
  let extractedText = "";
  try {
    extractedText = await extractText(buffer, file.name);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Text extraction failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // PDF バッファを解放（テキスト抽出後は不要）
  buffer = null;

  // Save extracted text to storage for later vectorization (avoids re-parsing large PDFs)
  const textPath = storagePath + ".extracted.txt";
  await supabase.storage
    .from("uploads")
    .upload(textPath, Buffer.from(extractedText, "utf-8"), {
      contentType: "text/plain; charset=utf-8",
    });

  // Save to knowledge_docs
  const { data: doc, error: dbError } = await supabase
    .from("knowledge_docs")
    .insert({
      team_id: profile.team_id,
      uploaded_by: user.id,
      title: title || file.name,
      file_name: file.name,
      storage_path: storagePath,
      doc_type: inferDocumentType(file.name),
      purpose,
      tags: tags ? JSON.parse(tags) : [],
      analysis_status: "pending",
    })
    .select("id")
    .single();

  if (dbError) {
    return NextResponse.json(
      { error: `DB save failed: ${dbError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: doc.id,
    extractedTextLength: extractedText.length,
    storagePath,
  });
}
