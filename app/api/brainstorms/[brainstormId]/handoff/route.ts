import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { buildBriefSheetMarkdown } from "@/lib/brief-sheet/format";
import { extractAnthropicCacheMetrics } from "@/lib/ai/cache-metadata";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { generateResearchQueries } from "@/lib/research/query-generator";
import {
  createQueryPresetMeta,
  type QueryPresetMeta,
} from "@/lib/research/query-preset";
import { extractQueriesFromKeywords } from "@/lib/research/text-utils";
import { normalizeKeywordTextToQueries } from "@/lib/research/topic-queries";

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

  const { data: session } = await supabase
    .from("brainstorm_sessions")
    .select("id, title, client_name, client_info, background, hypothesis, goal, constraints, research_topics, structure_draft, raw_markdown, chat_history, reasoning_chain, rejected_alternatives, key_expressions, discussion_note")
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
      output_type: "slide",
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
    reasoning_chain: session.reasoning_chain || "",
    rejected_alternatives: session.rejected_alternatives || "",
    key_expressions: session.key_expressions || "",
    discussion_note: session.discussion_note || "",
  });

  const { data: savedBrief, error: briefError } = await supabase
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
        reasoning_chain: session.reasoning_chain || "",
        rejected_alternatives: session.rejected_alternatives || "",
        key_expressions: session.key_expressions || "",
        discussion_note: session.discussion_note || "",
        raw_markdown: rawMarkdown,
        chat_history: session.chat_history || [],
      },
      { onConflict: "project_id" }
    )
    .select("updated_at")
    .single();

  if (briefError) {
    return NextResponse.json({ error: briefError.message }, { status: 500 });
  }

  const briefUpdatedAt =
    typeof savedBrief?.updated_at === "string" ? savedBrief.updated_at : null;

  try {
    const queryResult = await generateResearchQueries({
      supabase,
      teamId: profile.team_id,
      projectId: project.id,
      briefSheet: rawMarkdown,
      researchTopics: session.research_topics || "",
      endpoint: "/api/brainstorms/[brainstormId]/handoff",
      cacheMetadata: { projectId: project.id, source: "handoff" },
    });
    const { cacheReadInputTokens, cacheCreationInputTokens } =
      extractAnthropicCacheMetrics(queryResult.providerMetadata);

    await recordAiUsage({
      supabase,
      endpoint: "/api/brainstorms/[brainstormId]/handoff",
      operation: "generateText",
      model: "claude-sonnet-4-5-20250929",
      userId: user.id,
      projectId: project.id,
      teamId: profile.team_id,
      promptChars: queryResult.prompt.length,
      completionChars: JSON.stringify(queryResult.queries).length,
      usage: queryResult.usage,
      metadata: {
        cacheHit: queryResult.cacheHit,
        cacheLayer: queryResult.cacheLayer,
        cacheKeyPrefix: queryResult.cacheKeyPrefix,
        cacheReadInputTokens,
        cacheCreationInputTokens,
        requestFingerprintVersion: queryResult.requestFingerprintVersion,
        source: "handoff",
      },
    });

    const normalizedKeywords = normalizeKeywordTextToQueries(
      queryResult.queries.map((item) => item.query).join("\n")
    );
    const successMeta = createQueryPresetMeta({
      status: "success",
      source: "handoff",
      briefUpdatedAt,
    });

    const { data: memoRow } = await supabase
      .from("research_memos")
      .select("content")
      .eq("project_id", project.id)
      .single();
    const existingContent =
      memoRow?.content && typeof memoRow.content === "object"
        ? (memoRow.content as Record<string, unknown>)
        : {};

    await supabase.from("research_memos").upsert(
      {
        project_id: project.id,
        theme_keywords: normalizedKeywords,
        search_queries: extractQueriesFromKeywords(normalizedKeywords),
        content: {
          ...existingContent,
          query_preset: successMeta,
        },
      },
      { onConflict: "project_id" }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "キーワード候補の事前生成に失敗しました";
    const failedMeta: QueryPresetMeta = createQueryPresetMeta({
      status: "failed",
      source: "handoff",
      briefUpdatedAt,
      errorMessage: message,
    });

    const { data: memoRow } = await supabase
      .from("research_memos")
      .select("content")
      .eq("project_id", project.id)
      .single();
    const existingContent =
      memoRow?.content && typeof memoRow.content === "object"
        ? (memoRow.content as Record<string, unknown>)
        : {};

    await supabase.from("research_memos").upsert(
      {
        project_id: project.id,
        content: {
          ...existingContent,
          query_preset: failedMeta,
        },
      },
      { onConflict: "project_id" }
    );
    console.warn("[handoff] Failed to generate research query preset:", message);
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
