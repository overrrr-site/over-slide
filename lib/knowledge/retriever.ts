/**
 * RAG retriever for knowledge base.
 * Searches pgvector for similar chunks by type.
 */

import { createClient } from "@/lib/supabase/server";
import { embedQuery } from "./embeddings";
import type { ChunkType } from "./chunker";

export interface RetrievedChunk {
  id: string;
  chunkType: ChunkType;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

/**
 * Search for similar chunks in the knowledge base.
 */
export async function searchKnowledge(
  query: string,
  options: {
    teamId: string;
    chunkTypes?: ChunkType[];
    purpose?: "style" | "content";
    tags?: string[];
    limit?: number;
    threshold?: number;
  }
): Promise<RetrievedChunk[]> {
  const { teamId, chunkTypes, purpose, tags, limit = 5, threshold = 0.3 } = options;

  const queryEmbedding = await embedQuery(query);
  const supabase = await createClient();

  // Use RPC for vector similarity search
  const { data, error } = await supabase.rpc("search_knowledge_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_team_id: teamId,
    match_chunk_types: chunkTypes || null,
    match_count: limit,
    match_threshold: threshold,
  });

  if (error) {
    throw new Error(`Knowledge search failed: ${error.message}`);
  }

  let results = (data || []).map(
    (row: {
      id: string;
      chunk_type: ChunkType;
      content: string;
      metadata: Record<string, unknown>;
      similarity: number;
    }) => ({
      id: row.id,
      chunkType: row.chunk_type,
      content: row.content,
      metadata: row.metadata,
      similarity: row.similarity,
    })
  );

  // purpose でフィルタ（metadata.purpose を参照）
  if (purpose) {
    results = results.filter(
      (r: RetrievedChunk) => r.metadata.purpose === purpose
    );
  }

  // tags でフィルタ（metadata.tags に含まれるかチェック）
  if (tags && tags.length > 0) {
    results = results.filter((r: RetrievedChunk) => {
      const chunkTags = Array.isArray(r.metadata.tags) ? r.metadata.tags : [];
      return tags.some((t) => chunkTags.includes(t));
    });
  }

  return results;
}

/**
 * Search for reviewer profile chunks by tags.
 */
export async function searchReviewerProfile(
  teamId: string
): Promise<RetrievedChunk[]> {
  return searchKnowledge("レビュー判断基準 レビュアープロファイル", {
    teamId,
    chunkTypes: ["reviewer_profile" as ChunkType, "content" as ChunkType],
    purpose: "content",
    tags: ["レビュー基準", "判断軸"],
    limit: 3,
    threshold: 0.2,
  });
}

/**
 * Format retrieved chunks as context string for AI prompts.
 */
export function formatRetrievedContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const sections = chunks.map((chunk, i) => {
    const source =
      typeof chunk.metadata.docTitle === "string"
        ? ` 出典:${chunk.metadata.docTitle}`
        : "";
    const content = chunk.content.trim().replace(/\n{3,}/g, "\n\n");
    return `[KB${i + 1}${source}]\n${content}`;
  });

  return `\n\n[ナレッジ参照]\n${sections.join("\n\n")}`;
}
