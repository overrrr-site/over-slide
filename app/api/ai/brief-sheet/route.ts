import { NextRequest, NextResponse } from "next/server";
import { parseJsonWithSchema } from "@/lib/api/validation";
import { generateObject } from "ai";
import { z } from "zod";
import { opus } from "@/lib/ai/anthropic";
import { recordAiUsage } from "@/lib/ai/usage-logger";
import { buildBriefSheetPrompt } from "@/lib/ai/prompts/brief-sheet";
import { requireAuth } from "@/lib/api/auth";
import { createTimeoutController } from "@/lib/api/abort";
import { withErrorHandling } from "@/lib/api/error";
import { buildBriefSheetMarkdown } from "@/lib/brief-sheet/format";

const VALID_TONES = ["logical", "emotional", "hybrid"];

/** ブリーフシートの型定義（構造化出力用） */
const briefSheetSchema = z.object({
  client_info: z.string().describe("クライアント情報（社名/業種/規模/担当者の立場）。1〜2文。"),
  background: z.string().describe("背景・課題（現状の課題を2〜3文で）。省略せず完結させること。"),
  hypothesis: z.string().describe("提案の方向性（仮説・アイデアの要約）。具体的な施策や手法を含め、省略・途中打ち切りせず最後まで書くこと。"),
  goal: z.string().describe("ゴール（成功の定義）。1〜3文。"),
  constraints: z.string().describe("制約条件（予算/期間/技術/NG事項）。箇条書きは使わず、スラッシュ区切りで1つの文字列にまとめること。"),
  research_topics: z.string().describe("リサーチで確認すべきこと（不確定要素のリスト）。番号付きで列挙、途中で打ち切らないこと。"),
  structure_draft: z.string().describe("構成の骨格案（トーンに合わせた提案の流れ）。各セクションの見出しと1〜2文の説明を含め、必ず最後のセクションまで書き切ること。省略禁止。"),
});

const briefSheetRequestSchema = z
  .object({
    projectId: z.string().optional(),
    brainstormId: z.string().optional(),
    chatHistory: z
      .array(z.object({ role: z.string(), content: z.string() }))
      .min(1, "chatHistory is required"),
    tone: z.string().optional(),
  })
  .refine(
    (value) =>
      Boolean(
        (value.projectId && value.projectId.trim()) ||
          (value.brainstormId && value.brainstormId.trim())
      ),
    {
      message: "projectId or brainstormId is required",
    }
  );

export async function POST(request: NextRequest) {
  return withErrorHandling(
    async () => {
      const auth = await requireAuth();
      if (auth instanceof Response) {
        return auth;
      }
      const { supabase, user } = auth;

      const { projectId, brainstormId, chatHistory, tone } =
        await parseJsonWithSchema(request, briefSheetRequestSchema);

      const selectedTone =
        tone && VALID_TONES.includes(tone) ? tone : "hybrid";

      // アップロード済み資料を取得してプロンプトに含める
      let documentContext = "";
      if (brainstormId) {
        const { data: uploadedFiles } = await supabase
          .from("brainstorm_uploaded_files")
          .select("file_name, extracted_text")
          .eq("brainstorm_id", brainstormId);

        if (uploadedFiles?.length) {
          const docs = uploadedFiles
            .filter((f) => f.extracted_text)
            .map((f) => `### ${f.file_name}\n${f.extracted_text}`)
            .join("\n\n---\n\n");
          if (docs) {
            documentContext = `\n\n## 与件資料\n${docs}`;
          }
        }
      } else if (projectId) {
        const { data: uploadedFiles } = await supabase
          .from("uploaded_files")
          .select("file_name, extracted_text")
          .eq("project_id", projectId)
          .eq("purpose", "discussion");

        if (uploadedFiles?.length) {
          const docs = uploadedFiles
            .filter((f) => f.extracted_text)
            .map((f) => `### ${f.file_name}\n${f.extracted_text}`)
            .join("\n\n---\n\n");
          if (docs) {
            documentContext = `\n\n## 与件資料\n${docs}`;
          }
        }
      }

      // Format chat history as text
      const historyText = chatHistory
        .map(
          (msg: { role: string; content: string }) =>
            `[${msg.role === "user" ? "ユーザー" : "AI"}]: ${msg.content}`
        )
        .join("\n\n");

      const systemPrompt = buildBriefSheetPrompt(selectedTone);
      const prompt = `以下のチャット履歴からブリーフシートを生成してください:\n\n${historyText}${documentContext}`;
      const { signal, cleanup } = createTimeoutController(120_000);

      try {
        const { object: briefSheet, usage } = await generateObject({
          model: opus,
          schema: briefSheetSchema,
          system: systemPrompt,
          prompt,
          maxOutputTokens: 16384,
          abortSignal: signal,
        });

        const promptChars = systemPrompt.length + prompt.length;
        const completionChars = JSON.stringify(briefSheet).length;

        await recordAiUsage({
          supabase,
          endpoint: "/api/ai/brief-sheet",
          operation: "generateText",
          model: "claude-opus-4-6",
          userId: user.id,
          projectId,
          metadata: brainstormId ? { brainstorm_id: brainstormId } : {},
          promptChars,
          completionChars,
          usage,
        });

        // raw_markdown をフィールドから自動生成
        const rawMarkdown = buildBriefSheetMarkdown({
          client_info: briefSheet.client_info,
          background: briefSheet.background,
          hypothesis: briefSheet.hypothesis,
          goal: briefSheet.goal,
          constraints: briefSheet.constraints,
          research_topics: briefSheet.research_topics,
          structure_draft: briefSheet.structure_draft,
        });
        const result = { ...briefSheet, raw_markdown: rawMarkdown };

        // Save to DB
        let dbError: { message: string } | null = null;
        if (brainstormId) {
          const { error } = await supabase
            .from("brainstorm_sessions")
            .update({
              client_info: briefSheet.client_info,
              background: briefSheet.background,
              hypothesis: briefSheet.hypothesis,
              goal: briefSheet.goal,
              constraints: briefSheet.constraints,
              research_topics: briefSheet.research_topics,
              structure_draft: briefSheet.structure_draft,
              raw_markdown: rawMarkdown,
              chat_history: chatHistory,
              brief_tone: selectedTone,
              updated_at: new Date().toISOString(),
            })
            .eq("id", brainstormId);
          dbError = error;
        } else {
          const { error } = await supabase
            .from("brief_sheets")
            .upsert(
              {
                project_id: projectId,
                client_info: briefSheet.client_info,
                background: briefSheet.background,
                hypothesis: briefSheet.hypothesis,
                goal: briefSheet.goal,
                constraints: briefSheet.constraints,
                research_topics: briefSheet.research_topics,
                structure_draft: briefSheet.structure_draft,
                raw_markdown: rawMarkdown,
                chat_history: chatHistory,
              },
              { onConflict: "project_id" }
            );
          dbError = error;
        }

        if (dbError) {
          return NextResponse.json(
            { error: `DB保存に失敗しました: ${dbError.message}` },
            { status: 500 }
          );
        }

        return NextResponse.json(result);
      } finally {
        cleanup();
      }
    },
    {
      context: "brief-sheet",
      fallbackMessage: "ブリーフシートの生成に失敗しました",
    }
  );
}
