import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { convertSlidesToPdf } from "@/lib/slides/pdf-converter";
import type { HtmlPresentation } from "@/lib/slides/types";

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, profile } = auth;

  const { projectId } = await request.json();

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  // Timeout: abort after 120 seconds
  const controller = new AbortController();
  const abortTimeout = setTimeout(() => controller.abort(), 120_000);

  try {
    // Get latest generated file with HTML slides
    const { data: genFile, error: genErr } = await supabase
      .from("generated_files")
      .select("id, slide_data")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (genErr || !genFile) {
      return NextResponse.json(
        { error: "スライドデータが見つかりません" },
        { status: 404 }
      );
    }

    const presentation = genFile.slide_data as unknown as HtmlPresentation;
    if (!presentation?.slides?.length) {
      return NextResponse.json(
        { error: "スライドが空です" },
        { status: 400 }
      );
    }

    // Convert to PDF
    const pdfBuffer = await convertSlidesToPdf(presentation.slides, {
      timeout: 90_000,
    });

    // Upload to Supabase Storage
    const fileName = `${profile.team_id}/${projectId}/${Date.now()}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("generated")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[slides/pdf] Upload failed:", uploadErr);
      return NextResponse.json(
        { error: "PDFのアップロードに失敗しました" },
        { status: 500 }
      );
    }

    // Update storage_path in generated_files
    await supabase
      .from("generated_files")
      .update({ storage_path: fileName })
      .eq("id", genFile.id);

    // Get signed download URL
    const { data: signedUrl } = await supabase.storage
      .from("generated")
      .createSignedUrl(fileName, 3600);

    console.log(
      `[slides/pdf] Generated PDF (${presentation.slides.length} slides) for project ${projectId}`
    );

    return NextResponse.json({
      downloadUrl: signedUrl?.signedUrl,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "PDF生成に失敗しました";
    console.error(`[slides/pdf] Error projectId=${projectId}:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    clearTimeout(abortTimeout);
  }
}
