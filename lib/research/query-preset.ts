export const MAX_RESEARCH_QUERY_COUNT = 20;

export type QueryPresetSource =
  | "handoff"
  | "research_init"
  | "brief_save"
  | "manual";

export type QueryPresetStatus = "success" | "failed";

export interface QueryPresetMeta {
  version: 1;
  status: QueryPresetStatus;
  source: QueryPresetSource;
  brief_updated_at: string | null;
  generated_at: string;
  error_message: string | null;
}

export function createQueryPresetMeta(params: {
  status: QueryPresetStatus;
  source: QueryPresetSource;
  briefUpdatedAt: string | null;
  errorMessage?: string | null;
}): QueryPresetMeta {
  return {
    version: 1,
    status: params.status,
    source: params.source,
    brief_updated_at: params.briefUpdatedAt,
    generated_at: new Date().toISOString(),
    error_message: params.errorMessage ?? null,
  };
}

export interface QuerySuggestion {
  query: string;
  purpose: string;
  source?: string;
}

const SENTENCE_LIKE_QUERY =
  /(?:を調査|を確認|を把握|について調査|について確認|を調べる|したい|してください|の方法|を知りたい)$/i;
const ONLY_ASCII_LETTERS = /^[\x00-\x7F]+$/;
const HAS_JAPANESE = /[\u3040-\u30ff\u3400-\u9fff]/;

function isLikelyNarrativeQuery(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) return true;
  return SENTENCE_LIKE_QUERY.test(normalized);
}

function isEnglishOnlyQuery(value: string): boolean {
  return ONLY_ASCII_LETTERS.test(value) && !HAS_JAPANESE.test(value);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeQuerySuggestions(
  queries: QuerySuggestion[],
  maxCount = MAX_RESEARCH_QUERY_COUNT
): QuerySuggestion[] {
  const normalized: QuerySuggestion[] = [];
  const seen = new Set<string>();
  let englishOnlyCount = 0;

  for (const item of queries) {
    const query = normalizeWhitespace(item.query || "");
    if (!query || isLikelyNarrativeQuery(query)) continue;

    const dedupeKey = query.toLowerCase();
    if (seen.has(dedupeKey)) continue;

    const englishOnly = isEnglishOnlyQuery(query);
    if (englishOnly && englishOnlyCount >= 2) continue;

    seen.add(dedupeKey);
    if (englishOnly) englishOnlyCount += 1;

    normalized.push({
      query,
      purpose: normalizeWhitespace(item.purpose || ""),
      ...(item.source ? { source: item.source } : {}),
    });

    if (normalized.length >= maxCount) break;
  }

  return normalized;
}

export function parseQueryPresetMeta(value: unknown): QueryPresetMeta | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<QueryPresetMeta>;

  if (
    row.version !== 1 ||
    (row.status !== "success" && row.status !== "failed") ||
    (row.source !== "handoff" &&
      row.source !== "research_init" &&
      row.source !== "brief_save" &&
      row.source !== "manual") ||
    typeof row.generated_at !== "string"
  ) {
    return null;
  }

  return {
    version: 1,
    status: row.status,
    source: row.source,
    brief_updated_at:
      typeof row.brief_updated_at === "string" ? row.brief_updated_at : null,
    generated_at: row.generated_at,
    error_message:
      typeof row.error_message === "string" ? row.error_message : null,
  };
}
