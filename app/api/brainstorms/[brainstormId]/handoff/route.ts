import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { buildBriefSheetMarkdown } from "@/lib/brief-sheet/format";

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
  const outputType = body.outputType === "document" ? "document" : "slide";

  const { data: session } = await supabase
    .from("brainstorm_sessions")
    .select("id, title, client_name, client_info, background, hypothesis, goal, constraints, research_topics, structure_draft, raw_markdown, chat_history")
    .eq("id", brainstormId)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Brainstorm not found" }, { status: 404 });
  }

  const projectTitle = typeof body.title === "string" && body.title.trim()
    ? body.title.trim()
    : session.title || "新しいプロジェクト";
  const clientName = typeof body.clientName === "string"
    ? body.clientName.trim()
    : session.client_name || "";

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      team_id: profile.team_id,
      created_by: user.id,
      title: projectTitle,
      client_name: clientName,
      output_type: outputType,
      status: "in_progress",
      current_step: 1,
      origin_brainstorm_id: brainstormId,
    })
    .select("id, title, output_type, created_at")
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: projectError?.message || "Project creation failed" }, { status: 500 });
  }

  const rawMarkdown = session.raw_markdown || buildBriefSheetMarkdown({
    client_info: session.client_info || "",
    background: session.background || "",
    hypothesis: session.hypothesis || "",
    goal: session.goal || "",
    constraints: session.constraints || "",
    research_topics: session.research_topics || "",
    structure_draft: session.structure_draft || "",
  });

  const { error: briefError } = await supabase
    .from("brief_sheets")
    .upsert(
      {
        project_id: project.id,
        client_info: session.client_info || "",
        background: session.background || "",
        hypothesis: session.hypothesis || "",
        goal: session.goal || "",
        constraints: session.constraints || "",
        research_topics: session.research_topics || "",
        structure_draft: session.structure_draft || "",
        raw_markdown: rawMarkdown,
        chat_history: session.chat_history || [],
      },
      { onConflict: "project_id" }
    );

  if (briefError) {
    return NextResponse.json({ error: briefError.message }, { status: 500 });
  }

  await supabase
    .from("brainstorm_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", brainstormId);

  return NextResponse.json({
    project,
    redirectTo: `/projects/${project.id}/research`,
  });
}
