import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { generatePptx } from "@/lib/pptx/generator";
import type { PresentationData } from "@/lib/pptx/types";

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, profile } = auth;

  const body = await request.json();
  const { projectId, slideData } = body as {
    projectId: string;
    slideData: PresentationData;
  };

  if (!projectId || !slideData) {
    return NextResponse.json(
      { error: "projectId and slideData are required" },
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
    const buffer = await generatePptx(slideData);

    // Upload to Supabase Storage
    const fileName = `${profile.team_id}/${projectId}/${Date.now()}.pptx`;
    const { error: uploadError } = await supabase.storage
      .from("generated")
      .upload(fileName, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
        file_type: "pptx",
        storage_path: fileName,
        slide_data: slideData,
      })
      .select("id")
      .single();

    if (dbError) {
      return NextResponse.json(
        { error: `DB save failed: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Generate signed download URL (valid for 1 hour)
    const { data: signedUrl } = await supabase.storage
      .from("generated")
      .createSignedUrl(fileName, 3600);

    return NextResponse.json({
      id: genFile.id,
      downloadUrl: signedUrl?.signedUrl,
      storagePath: fileName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PPTX generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
