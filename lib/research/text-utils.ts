export interface SearchResultLike {
  title?: string;
  url?: string;
  content?: string;
}

export type NormalizedSearchResult = {
  title: string;
  url: string;
  content: string;
};

export function sanitizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function truncateForPrompt(text: string, maxChars: number): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...[省略]`;
}

export function dedupeSearchResults(
  results: SearchResultLike[]
): NormalizedSearchResult[] {
  const seen = new Set<string>();
  const deduped: NormalizedSearchResult[] = [];

  for (const result of results) {
    const title = sanitizeText(result.title) || "無題";
    const url = sanitizeText(result.url);
    const content = sanitizeText(result.content);
    const key = (url || title || content.slice(0, 120)).toLowerCase();

    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push({ title, url, content });
  }

  return deduped;
}

export function mergeSearchResults(
  previous: SearchResultLike[],
  incoming: SearchResultLike[]
): NormalizedSearchResult[] {
  return dedupeSearchResults([...previous, ...incoming]);
}

export function extractQueriesFromKeywords(text: string): string[] {
  const seen = new Set<string>();
  const queries: string[] = [];

  for (const line of text.split("\n")) {
    const query = line.trim();
    if (!query || seen.has(query)) continue;
    seen.add(query);
    queries.push(query);
  }

  return queries;
}

export function mergeKeywordText(
  currentText: string,
  incomingQueries: string[]
): string {
  const merged = extractQueriesFromKeywords(currentText);
  const seen = new Set(merged);

  for (const rawQuery of incomingQueries) {
    const query = rawQuery.trim();
    if (!query || seen.has(query)) continue;
    seen.add(query);
    merged.push(query);
  }

  return merged.join("\n");
}

export function normalizeSearchResults(
  raw: unknown
): NormalizedSearchResult[] {
  if (!Array.isArray(raw)) return [];

  return dedupeSearchResults(
    raw.map((item) => {
      if (!item || typeof item !== "object") return {};
      const row = item as SearchResultLike;
      return {
        title: sanitizeText(row.title),
        url: sanitizeText(row.url),
        content: sanitizeText(row.content),
      };
    })
  );
}
