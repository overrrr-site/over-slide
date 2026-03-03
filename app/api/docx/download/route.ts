import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";

/**
 * GET /api/docx/download?id=xxx
 * generated_files の ID を指定して、Supabase Storage のファイルをプロキシダウンロードする。
 */
export async function GET(request: NextRequest) {
  const fileId = request.nextUrl.searchParams.get("id");
  if (!fileId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  // ファイル情報を取得
  const { data: genFile } = await supabase
    .from("generated_files")
    .select("storage_path, file_type, project_id")
    .eq("id", fileId)
    .single();

  if (!genFile) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // プロジェクト名を取得（ファイル名に使う）
  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", genFile.project_id)
    .single();

  // Supabase Storage からファイルをダウンロード
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("generated")
    .download(genFile.storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: `Download failed: ${downloadError?.message || "unknown"}` },
      { status: 500 }
    );
  }

  // ファイル名を生成（プロジェクト名 or デフォルト）
  const ext = genFile.file_type || "docx";
  const safeName = (project?.title || "document")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .slice(0, 100);
  const fileName = `${safeName}.${ext}`;

  // Content-Type を判定
  const contentTypeMap: Record<string, string> = {
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    pdf: "application/pdf",
  };
  const contentType = contentTypeMap[ext] || "application/octet-stream";

  const buffer = await fileData.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
