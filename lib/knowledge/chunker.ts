/**
 * Knowledge document chunker.
 * Splits analysis results into 4 chunk types for RAG retrieval.
 */

export type ChunkType = "composition" | "page" | "style" | "expression" | "correction" | "content";

export interface Chunk {
  chunkType: ChunkType;
  content: string;
  metadata: Record<string, unknown>;
}

interface AnalysisResult {
  composition?: string;
  pages?: Array<{
    pageNumber: number;
    masterType: string;
    title: string;
    content: string;
  }>;
  style?: string;
  expressions?: string[];
}

/**
 * Split Claude analysis output into typed chunks for embedding.
 */
export function createChunks(
  analysis: AnalysisResult,
  docTitle: string
): Chunk[] {
  const chunks: Chunk[] = [];

  // 1. Composition chunk: overall structure patterns
  if (analysis.composition) {
    chunks.push({
      chunkType: "composition",
      content: analysis.composition,
      metadata: { docTitle, section: "composition" },
    });
  }

  // 2. Page chunks: individual page patterns
  if (analysis.pages) {
    for (const page of analysis.pages) {
      chunks.push({
        chunkType: "page",
        content: `[${page.masterType}] ${page.title}\n${page.content}`,
        metadata: {
          docTitle,
          pageNumber: page.pageNumber,
          masterType: page.masterType,
        },
      });
    }
  }

  // 3. Style chunk: writing style and tone
  if (analysis.style) {
    chunks.push({
      chunkType: "style",
      content: analysis.style,
      metadata: { docTitle, section: "style" },
    });
  }

  // 4. Expression chunks: reusable phrases and expressions
  if (analysis.expressions?.length) {
    // Group expressions into chunks of ~5 for better embedding
    const groupSize = 5;
    for (let i = 0; i < analysis.expressions.length; i += groupSize) {
      const group = analysis.expressions.slice(i, i + groupSize);
      chunks.push({
        chunkType: "expression",
        content: group.join("\n"),
        metadata: {
          docTitle,
          section: "expression",
          groupIndex: Math.floor(i / groupSize),
        },
      });
    }
  }

  return chunks;
}
