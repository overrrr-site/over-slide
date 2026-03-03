import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 100);
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  const { data: row } = await supabase
    .from("brainstorm_exports")
    .select("id, brainstorm_id, file_type, storage_path")
    .eq("id", id)
    .single();

  if (!row) {
    return NextResponse.json({ error: "Export not found" }, { status: 404 });
  }

  const { data: session } = await supabase
    .from("brainstorm_sessions")
    .select("title")
    .eq("id", row.brainstorm_id)
    .single();

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("generated")
    .download(row.storage_path);

  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: `Download failed: ${downloadError?.message || "unknown"}` },
      { status: 500 }
    );
  }

  const ext = row.file_type;
  const contentTypeMap: Record<string, string> = {
    md: "text/markdown; charset=utf-8",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const contentType = contentTypeMap[ext] || "application/octet-stream";
  const fileName = `${sanitizeFileName(session?.title || "brief")}.${ext}`;

  const buffer = await fileData.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
