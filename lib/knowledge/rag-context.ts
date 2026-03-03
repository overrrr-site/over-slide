import type { ChunkType } from "@/lib/knowledge/chunker";
import { formatRetrievedContext, searchKnowledge } from "@/lib/knowledge/retriever";

interface BuildRagContextParams {
  query: string;
  teamId: string | null;
  chunkTypes: ChunkType[];
  limit: number;
  logContext?: string;
}

export async function buildRagContext({
  query,
  teamId,
  chunkTypes,
  limit,
  logContext,
}: BuildRagContextParams): Promise<string> {
  if (!teamId) return "";

  try {
    const chunks = await searchKnowledge(query, {
      teamId,
      chunkTypes,
      limit,
    });
    if (chunks.length > 0 && logContext) {
      console.log(`[${logContext}] Found ${chunks.length} knowledge chunks`);
    }
    return formatRetrievedContext(chunks);
  } catch {
    // RAG failure should not block the main flow
    return "";
  }
}
