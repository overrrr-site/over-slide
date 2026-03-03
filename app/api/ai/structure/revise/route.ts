import { NextRequest, NextResponse } from "next/server";
import { assertInput, parseJsonBody } from "@/lib/api/validation";
import { generateText } from "ai";
import { opus } from "@/lib/ai/anthropic";
import { parseJsonObjectFromText } from "@/lib/ai/json-response";
import { compactJsonForPrompt } from "@/lib/ai/prompt-utils";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { STRUCTURE_PROMPT } from "@/lib/ai/prompts/structure";
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
        chunkTypes: ["composition", "correction"],
        limit: 3,
        logContext: "structure/revise",
      });

      // Generate revised page with AI
      const prompt = `## 修正対象ページ（現在の内容）
${compactJsonForPrompt(currentPage)}

## 修正指示
${instruction}

上記の修正指示に従って、このページの構成を修正してください。
page_number は ${pageNumber} のまま変更しないでください。
修正したページ1件分のJSONのみを出力してください。

出力形式:
{
  "page_number": ${pageNumber},
  "master_type": "...",
  "title": "...",
  "purpose": "...",
  "key_content": "...",
  "notes": "..."
}${ragContext}`;

      const { text, usage } = await generateText({
        model: opus,
        system: STRUCTURE_PROMPT,
        prompt,
      });

      await recordAiUsage({
        supabase,
        endpoint: "/api/ai/structure/revise",
        operation: "generateText",
        model: "claude-opus-4-6",
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

      // Get current structure
      const { data: structureData, error: structErr } = await supabase
        .from("structures")
        .select("id, pages")
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

      // Replace the target page in the pages array
      const pages = structureData.pages as Array<{
        page_number: number;
        [key: string]: unknown;
      }>;
      const updatedPages = pages.map((p) =>
        p.page_number === pageNumber
          ? { ...revisedPage, page_number: pageNumber }
          : p
      );

      // Update structures table
      const { error: updateErr } = await supabase
        .from("structures")
        .update({ pages: updatedPages })
        .eq("id", structureData.id);

      if (updateErr) {
        console.error("[structure/revise] Update failed:", updateErr);
        return NextResponse.json(
          { error: "Failed to save revision" },
          { status: 500 }
        );
      }

      // Save revision instruction history
      await supabase.from("revision_instructions").insert({
        project_id: projectId,
        step_type: "structure",
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
          stepType: "structure",
          pageNumber,
          instruction,
          originalContent: currentPage,
          revisedContent: revisedPage,
        }).catch(() => {}); // Fire-and-forget
      }

      console.log(
        `[structure/revise] Revised page ${pageNumber} for project ${projectId}`
      );

      return NextResponse.json({ revisedPage });
    },
    {
      context: "structure/revise",
      fallbackMessage: "Revision failed",
    }
  );
}
