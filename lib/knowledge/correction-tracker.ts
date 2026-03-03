/**
 * Correction Tracker: 修正指示を学習データとして蓄積
 * 修正前後の内容と指示テキストを correction チャンクとして保存し、
 * 次回以降の生成でRAG経由で活用する。
 */

import { createClient } from "@/lib/supabase/server";
import { embedTexts } from "./embeddings";

interface CorrectionData {
  teamId: string;
  userId: string;
  stepType: "structure" | "details" | "design";
  pageNumber: number;
  instruction: string;
  originalContent: Record<string, unknown>;
  revisedContent: Record<string, unknown>;
}

/**
 * Get or create the virtual "correction learning" document for a team.
 * Each team has one doc that holds all correction chunks.
 */
async function getOrCreateCorrectionDoc(
  teamId: string,
  userId: string
): Promise<string> {
  const supabase = await createClient();

  // Check for existing correction doc
  const { data: existing } = await supabase
    .from("knowledge_docs")
    .select("id")
    .eq("team_id", teamId)
    .eq("doc_type", "correction")
    .limit(1)
    .single();

  if (existing) return existing.id;

  // Create new correction doc
  const { data: newDoc, error } = await supabase
    .from("knowledge_docs")
    .insert({
      team_id: teamId,
      uploaded_by: userId,
      title: "修正パターン学習",
      file_name: "_system_corrections_",
      storage_path: "_none_",
      doc_type: "correction",
      analysis_status: "analyzed",
    })
    .select("id")
    .single();

  if (error || !newDoc) {
    throw new Error(`Failed to create correction doc: ${error?.message}`);
  }

  return newDoc.id;
}

/**
 * Save a revision as a correction learning chunk.
 * Generates an embedding and stores it for future RAG retrieval.
 */
export async function saveCorrectionChunk(
  data: CorrectionData
): Promise<void> {
  const {
    teamId,
    userId,
    stepType,
    pageNumber,
    instruction,
    originalContent,
    revisedContent,
  } = data;

  try {
    const docId = await getOrCreateCorrectionDoc(teamId, userId);
    const supabase = await createClient();

    // Build human-readable text for embedding
    const originalTitle =
      (originalContent.title as string) || `Page ${pageNumber}`;
    const revisedTitle =
      (revisedContent.title as string) || `Page ${pageNumber}`;

    const chunkText = [
      `[修正パターン: ${stepType}]`,
      `ページ: ${pageNumber} (${originalTitle})`,
      `指示: ${instruction}`,
      `変更前の主要内容: ${JSON.stringify(originalContent).slice(0, 300)}`,
      `変更後の主要内容: ${JSON.stringify(revisedContent).slice(0, 300)}`,
    ].join("\n");

    // Generate embedding
    const [embedding] = await embedTexts([chunkText]);

    // Insert correction chunk
    const { error } = await supabase.from("knowledge_chunks").insert({
      doc_id: docId,
      chunk_type: "correction",
      content: chunkText,
      metadata: {
        stepType,
        pageNumber,
        instruction,
        originalTitle,
        revisedTitle,
      },
      embedding: JSON.stringify(embedding),
    });

    if (error) {
      console.error("[correction-tracker] Insert failed:", error);
    } else {
      console.log(
        `[correction-tracker] Saved correction for ${stepType} page ${pageNumber}`
      );
    }
  } catch (err) {
    // Correction tracking is non-critical
    console.error("[correction-tracker] Error:", err);
  }
}
