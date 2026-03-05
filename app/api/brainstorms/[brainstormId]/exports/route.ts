import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { generateDocx } from "@/lib/docx/generator";
import type { DocumentData, DocxSection } from "@/lib/docx/types";
import { buildBriefSheetMarkdown } from "@/lib/brief-sheet/format";

interface BriefFields {
  client_info: string;
  background: string;
  hypothesis: string;
  goal: string;
  constraints: string;
  research_topics: string;
  structure_draft: string;
  reasoning_chain?: string;
  rejected_alternatives?: string;
  key_expressions?: string;
  discussion_note?: string;
}

/** 構成骨格案のテキストを番号付き項目に分割する */
function parseStructureDraft(text: string): DocxSection[] {
  // 「1. 」「2. 」等の番号付きリスト or 「セクション1：」形式を検出
  const lines = text.split(/\n/).filter((l) => l.trim());
  const items: DocxSection[] = [];

  for (const line of lines) {
    const match = line.match(/^\d+[\.\)．）]\s*(.+)/);
    if (match) {
      // 「セクション名：説明」を分割
      const colonIdx = match[1].search(/[：:]/);
      if (colonIdx > 0) {
        items.push({
          level: 2,
          title: match[1].slice(0, colonIdx).trim(),
          body: match[1].slice(colonIdx + 1).trim(),
        });
      } else {
        items.push({ level: 2, title: match[1].trim(), body: undefined });
      }
    }
  }

  // 番号付きリストが検出できなかった場合は段落テキストとして返す
  if (items.length === 0) {
    return [{ level: 2, title: "概要", body: text }];
  }
  return items;
}

function buildDocumentData(
  title: string,
  clientName: string,
  fields: BriefFields
): DocumentData {
  const f = (v: string | undefined) => v?.trim() || "（未定）";

  const sections: DocxSection[] = [];

  // H1: プロジェクト概要
  sections.push({
    level: 1,
    title: "プロジェクト概要",
    children: [
      { level: 2, title: "クライアント", body: f(fields.client_info) },
      { level: 2, title: "背景・課題", body: f(fields.background) },
      { level: 2, title: "ゴール", body: f(fields.goal) },
      { level: 2, title: "制約条件", body: f(fields.constraints) },
    ],
  });

  // H1: 提案の方向性
  sections.push({
    level: 1,
    title: "提案の方向性",
    body: f(fields.hypothesis),
  });

  // H1: 構成の骨格案（番号付き項目をH2に分割）
  sections.push({
    level: 1,
    title: "構成の骨格案",
    children: parseStructureDraft(f(fields.structure_draft)),
  });

  // H1: リサーチで確認すべきこと
  sections.push({
    level: 1,
    title: "リサーチで確認すべきこと",
    body: f(fields.research_topics),
  });

  // H1: 議論の記録（新フィールドがあれば追加）
  const discussionChildren: DocxSection[] = [];
  if (fields.reasoning_chain?.trim()) {
    discussionChildren.push({ level: 2, title: "思考の流れ", body: fields.reasoning_chain.trim() });
  }
  if (fields.rejected_alternatives?.trim()) {
    discussionChildren.push({ level: 2, title: "却下した選択肢", body: fields.rejected_alternatives.trim() });
  }
  if (fields.key_expressions?.trim()) {
    discussionChildren.push({ level: 2, title: "キーフレーズ", body: fields.key_expressions.trim() });
  }
  if (fields.discussion_note?.trim()) {
    discussionChildren.push({ level: 2, title: "議論ノート", body: fields.discussion_note.trim() });
  }
  if (discussionChildren.length > 0) {
    sections.push({
      level: 1,
      title: "議論の記録",
      children: discussionChildren,
    });
  }

  return {
    title: `${title} - ブリーフシート`,
    subtitle: clientName || undefined,
    date: new Date().toLocaleDateString("ja-JP"),
    sections,
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
    .select("id, title, client_name, client_info, background, hypothesis, goal, constraints, research_topics, structure_draft, raw_markdown, reasoning_chain, rejected_alternatives, key_expressions, discussion_note")
    .eq("id", brainstormId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Brainstorm not found" }, { status: 404 });
  }

  const briefFields: BriefFields = {
    client_info: session.client_info || "",
    background: session.background || "",
    hypothesis: session.hypothesis || "",
    goal: session.goal || "",
    constraints: session.constraints || "",
    research_topics: session.research_topics || "",
    structure_draft: session.structure_draft || "",
    reasoning_chain: session.reasoning_chain || "",
    rejected_alternatives: session.rejected_alternatives || "",
    key_expressions: session.key_expressions || "",
    discussion_note: session.discussion_note || "",
  };

  const markdown = session.raw_markdown || buildBriefSheetMarkdown(briefFields);

  let buffer: Buffer;
  let contentType: string;

  if (fileType === "md") {
    buffer = Buffer.from(markdown, "utf-8");
    contentType = "text/markdown; charset=utf-8";
  } else {
    const documentData = buildDocumentData(
      session.title || "ブリーフ",
      session.client_name || "",
      briefFields,
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
