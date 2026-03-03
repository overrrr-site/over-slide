import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { generateDocx } from "@/lib/docx/generator";
import type { DocumentData } from "@/lib/docx/types";
import { buildBriefSheetMarkdown } from "@/lib/brief-sheet/format";

function buildDocumentData(
  title: string,
  clientName: string,
  fields: {
    client_info: string;
    background: string;
    hypothesis: string;
    goal: string;
    constraints: string;
    research_topics: string;
    structure_draft: string;
  }
): DocumentData {
  const sections = [
    { key: "client_info", label: "クライアント" },
    { key: "background", label: "背景・課題" },
    { key: "hypothesis", label: "提案の方向性" },
    { key: "goal", label: "ゴール" },
    { key: "constraints", label: "制約条件" },
    { key: "research_topics", label: "リサーチで確認すべきこと" },
    { key: "structure_draft", label: "構成の骨格案" },
  ] as const;

  return {
    title: `${title} - ブリーフシート`,
    subtitle: clientName || undefined,
    sections: sections.map((item) => ({
      level: 2,
      title: item.label,
      body: fields[item.key] || "（未定）",
    })),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brainstormId: string }> }
) {
  const { brainstormId } = await params;
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, user, profile } = auth;

  const body = await request.json().catch(() => ({}));
  const fileType = body.fileType === "docx" ? "docx" : body.fileType === "md" ? "md" : null;

  if (!fileType) {
    return NextResponse.json({ error: "fileType must be md or docx" }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("brainstorm_sessions")
    .select("id, title, client_name, client_info, background, hypothesis, goal, constraints, research_topics, structure_draft, raw_markdown")
    .eq("id", brainstormId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Brainstorm not found" }, { status: 404 });
  }

  const markdown = session.raw_markdown || buildBriefSheetMarkdown({
    client_info: session.client_info || "",
    background: session.background || "",
    hypothesis: session.hypothesis || "",
    goal: session.goal || "",
    constraints: session.constraints || "",
    research_topics: session.research_topics || "",
    structure_draft: session.structure_draft || "",
  });

  let buffer: Buffer;
  let contentType: string;

  if (fileType === "md") {
    buffer = Buffer.from(markdown, "utf-8");
    contentType = "text/markdown; charset=utf-8";
  } else {
    const documentData = buildDocumentData(
      session.title || "ブリーフ",
      session.client_name || "",
      {
        client_info: session.client_info || "",
        background: session.background || "",
        hypothesis: session.hypothesis || "",
        goal: session.goal || "",
        constraints: session.constraints || "",
        research_topics: session.research_topics || "",
        structure_draft: session.structure_draft || "",
      }
    );
    buffer = await generateDocx(documentData);
    contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  const storagePath = `${profile.team_id}/brainstorms/${brainstormId}/${Date.now()}.${fileType}`;

  const { error: uploadError } = await supabase.storage
    .from("generated")
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: exportRow, error: insertError } = await supabase
    .from("brainstorm_exports")
    .insert({
      brainstorm_id: brainstormId,
      team_id: profile.team_id,
      exported_by: user.id,
      file_type: fileType,
      storage_path: storagePath,
    })
    .select("id, file_type, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: `DB save failed: ${insertError.message}` }, { status: 500 });
  }

  await supabase
    .from("brainstorm_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", brainstormId);

  return NextResponse.json({
    export: exportRow,
    downloadUrl: `/api/brainstorms/exports/download?id=${exportRow.id}`,
  });
}
