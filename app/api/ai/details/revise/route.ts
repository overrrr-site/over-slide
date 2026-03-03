import { NextRequest, NextResponse } from "next/server";
import { assertInput, parseJsonBody } from "@/lib/api/validation";
import { generateText } from "ai";
import { sonnet } from "@/lib/ai/anthropic";
import { parseJsonObjectFromText } from "@/lib/ai/json-response";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { DETAILS_PROMPT } from "@/lib/ai/prompts/details";
import { requireAuth } from "@/lib/api/auth";
import { getTeamIdForUser } from "@/lib/api/team";
import { withErrorHandling } from "@/lib/api/error";
import { buildRagContext } from "@/lib/knowledge/rag-context";
import { saveCorrectionChunk } from "@/lib/knowledge/correction-tracker";

export async function POST(request: NextRequest) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }
      const { supabase, user } = auth;

      const { projectId, pageNumber, instruction, currentPage } =
        await parseJsonBody(request);

      assertInput(
        projectId && pageNumber && instruction && currentPage,
        "Missing required fields"
      );

      const teamId = await getTeamIdForUser(supabase, user.id);
      const ragContext = await buildRagContext({
        query: instruction,
        teamId,
        chunkTypes: ["correction", "style", "expression"],
        limit: 5,
        logContext: "details/revise",
      });

      // Generate revised page with AI
      const prompt = `## 修正対象ページ（現在の内容）
${compactJsonForPrompt(currentPage)}

## 修正指示
${instruction}

上記の修正指示に従って、このページの詳細コンテンツを修正してください。
page_number は ${pageNumber} のまま変更しないでください。
修正したページ1件分のJSONのみを出力してください。

出力形式（該当するフィールドのみ含めてください）:
{
  "page_number": ${pageNumber},
  "master_type": "...",
  "title": "...",
  "subtitle": "...",
  "body": "...",
  "bullets": [...],
  "kpis": [...],
  "table": {...},
  "chart": {...},
  "notes": "..."
}${ragContext}`;

      const { text, usage } = await generateText({
        model: sonnet,
        system: DETAILS_PROMPT,
        prompt,
      });

      await recordAiUsage({
        supabase,
        endpoint: "/api/ai/details/revise",
        operation: "generateText",
        model: "claude-sonnet-4-5-20250929",
        userId: user.id,
        teamId,
        projectId,
        promptChars: prompt.length,
        completionChars: text.length,
        usage,
      });

      let revisedPage: Record<string, unknown>;
      try {
        revisedPage = parseJsonObjectFromText<Record<string, unknown>>(text);
      } catch {
        return NextResponse.json(
          { error: "Failed to parse AI response" },
          { status: 500 }
        );
      }

      // Get structure id
      const { data: structureData, error: structErr } = await supabase
        .from("structures")
        .select("id")
        .eq("project_id", projectId)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (structErr || !structureData) {
        return NextResponse.json(
          { error: "Structure not found" },
          { status: 404 }
        );
      }

      // Upsert the revised page_content
      const { error: upsertErr } = await supabase
        .from("page_contents")
        .upsert(
          {
            structure_id: structureData.id,
            page_number: pageNumber,
            content: revisedPage,
          },
          { onConflict: "structure_id,page_number" }
        );

      if (upsertErr) {
        console.error("[details/revise] Upsert failed:", upsertErr);
        return NextResponse.json(
          { error: "Failed to save revision" },
          { status: 500 }
        );
      }

      // Save revision instruction history
      await supabase.from("revision_instructions").insert({
        project_id: projectId,
        step_type: "details",
        page_number: pageNumber,
        instruction,
        original_content: currentPage,
        revised_content: revisedPage,
      });

      // Save as correction learning chunk (non-blocking)
      if (teamId) {
        saveCorrectionChunk({
          teamId,
          userId: user.id,
          stepType: "details",
          pageNumber,
          instruction,
          originalContent: currentPage,
          revisedContent: revisedPage,
        }).catch(() => {});
      }

      console.log(
        `[details/revise] Revised page ${pageNumber} for project ${projectId}`
      );

      return NextResponse.json({ revisedPage });
    },
    {
      context: "details/revise",
      fallbackMessage: "Revision failed",
    }
  );
}
