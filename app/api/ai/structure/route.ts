import { streamText } from "ai";
import { opus } from "@/lib/ai/anthropic";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { STRUCTURE_PROMPT, DOCUMENT_STRUCTURE_PROMPT } from "@/lib/ai/prompts/structure";
import { createClient } from "@/lib/supabase/server";
import { searchKnowledge, formatRetrievedContext } from "@/lib/knowledge/retriever";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", user.id)
    .single();

  const body = await request.json();
  const { projectId } = body;

  // useChat's DefaultChatTransport sends data inside messages array
  let briefSheet = body.briefSheet || "";
  let researchMemo = body.researchMemo || "";

  if (!briefSheet && body.messages?.length) {
    const lastUserMsg = [...body.messages]
      .reverse()
      .find((m: Record<string, unknown>) => m.role === "user");
    if (lastUserMsg) {
      let msgText = "";
      if (typeof lastUserMsg.content === "string") {
        msgText = lastUserMsg.content;
      } else if (lastUserMsg.parts) {
        const parts = lastUserMsg.parts as Array<{ type: string; text?: string }>;
        msgText = parts
          .filter((p) => p.type === "text")
          .map((p) => p.text || "")
          .join("");
      }
      try {
        const parsed = JSON.parse(msgText);
        briefSheet = parsed.briefSheet || briefSheet;
        researchMemo = parsed.researchMemo || researchMemo;
      } catch {
        // Not JSON — use as-is
      }
    }
  }

  // RAG: Retrieve composition patterns from knowledge base
  let ragContext = "";
  if (profile?.team_id) {
    try {
      const chunks = await searchKnowledge(
        `提案書の構成パターン ${briefSheet?.slice(0, 200) || ""}`,
        {
          teamId: profile.team_id,
          chunkTypes: ["composition", "correction"],
          limit: 5,
        }
      );
      ragContext = formatRetrievedContext(chunks);
    } catch {
      // RAG failure is non-critical
    }
  }

  // output_type に応じてプロンプトを切り替え
  let outputType = "slide";
  if (projectId) {
    const { data: projectData } = await supabase
      .from("projects")
      .select("output_type")
      .eq("id", projectId)
      .single();
    if (projectData?.output_type) {
      outputType = projectData.output_type;
    }
  }

  const systemPrompt = outputType === "document"
    ? DOCUMENT_STRUCTURE_PROMPT
    : STRUCTURE_PROMPT;

  const prompt = [
    `## ブリーフシート\n${briefSheet}`,
    researchMemo ? `## リサーチメモ\n${researchMemo}` : "",
    ragContext,
    "\n上記をもとに、提案書のページ構成を作成してください。",
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = streamText({
    model: opus,
    system: systemPrompt,
    prompt,
    async onFinish({ text, totalUsage }) {
      await recordAiUsage({
        supabase,
        endpoint: "/api/ai/structure",
        operation: "streamText",
        model: "claude-opus-4-6",
        userId: user.id,
        teamId: profile?.team_id,
        projectId,
        promptChars: prompt.length,
        completionChars: text.length,
        usage: totalUsage,
      });

      if (projectId) {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            await supabase.from("structures").upsert(
              {
                project_id: projectId,
                version: 1,
                pages: parsed.pages,
              },
              { onConflict: "project_id,version" }
            );
          } catch {
            // Parse failure is non-critical
          }
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
}
