import { formatRetrievedContext, searchKnowledge } from "@/lib/knowledge/retriever";
import { sanitizeText, truncateForPrompt } from "@/lib/research/text-utils";

const KNOWLEDGE_CONTEXT_CHARS = 6_000;

interface FetchResearchKnowledgeContextParams {
  teamId: string | null;
  briefSheet?: string;
  keywords?: string;
  instruction?: string;
  memo?: string;
  unresolvedIssues?: string[];
  limit?: number;
  threshold?: number;
}

interface ResearchKnowledgeContextResult {
  context: string;
  chunkCount: number;
  query: string;
}

function normalizeForQuery(value: string, maxChars: number): string {
  return truncateForPrompt(sanitizeText(value).replace(/\s+/g, " "), maxChars);
}

function buildResearchKnowledgeQuery(
  params: FetchResearchKnowledgeContextParams
): string {
  const unresolved = (params.unresolvedIssues || [])
    .slice(0, 5)
    .map((item) => normalizeForQuery(item, 140))
    .filter(Boolean)
    .join(" ");

  return [
    normalizeForQuery(params.keywords || "", 320),
    unresolved,
    normalizeForQuery(params.instruction || "", 220),
    normalizeForQuery(params.briefSheet || "", 420),
    normalizeForQuery(params.memo || "", 260),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export async function fetchResearchKnowledgeContext(
  params: FetchResearchKnowledgeContextParams
): Promise<ResearchKnowledgeContextResult> {
  if (!params.teamId) {
    return { context: "", chunkCount: 0, query: "" };
  }

  const query = buildResearchKnowledgeQuery(params);
  if (!query) {
    return { context: "", chunkCount: 0, query: "" };
  }

  try {
    const chunks = await searchKnowledge(query, {
      teamId: params.teamId,
      chunkTypes: ["content"],
      purpose: "content",
      limit: params.limit ?? 6,
      threshold: params.threshold ?? 0.2,
    });

    const rawContext = formatRetrievedContext(chunks);
    const context = rawContext
      ? truncateForPrompt(rawContext, KNOWLEDGE_CONTEXT_CHARS)
      : "";

    return {
      context,
      chunkCount: chunks.length,
      query,
    };
  } catch {
    return { context: "", chunkCount: 0, query };
  }
}
