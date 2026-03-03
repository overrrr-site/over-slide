const NO_OP_PATTERN =
  /^(ok|okay|thanks|thank you|thx|了解|了承|承知|ありがとう|そのまま|変更なし|no change|none|skip)$/i;

function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isLowSignalInstruction(instruction: string): boolean {
  const normalized = normalize(instruction);
  if (!normalized) return true;
  if (NO_OP_PATTERN.test(normalized)) return true;
  return normalized.length < 4;
}

export function dedupeFeedbackItems<T extends { target_page?: number; description: string; suggestion?: string }>(
  items: T[]
): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    const key = [
      item.target_page ?? 0,
      normalize(item.description || ""),
      normalize(item.suggestion || ""),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => unknown;
  };
};

type SupabaseQueryLike = {
  eq: (column: string, value: string | number) => SupabaseQueryLike;
  order: (
    column: string,
    options: { ascending: boolean }
  ) => {
    limit: (count: number) => PromiseLike<{
      data: Array<Record<string, unknown>> | null;
      error: { message: string } | null;
    }>;
  };
};

export interface DuplicateRevisionLookupParams {
  supabase: unknown;
  projectId: string;
  stepType: "structure" | "details" | "design";
  pageNumber: number;
  instruction: string;
}

export interface DuplicateRevisionResult {
  originalContent: Record<string, unknown> | null;
  revisedContent: Record<string, unknown>;
}

export async function findDuplicateRevisionResult({
  supabase,
  projectId,
  stepType,
  pageNumber,
  instruction,
}: DuplicateRevisionLookupParams): Promise<DuplicateRevisionResult | null> {
  if (!supabase || typeof supabase !== "object") return null;

  const db = supabase as SupabaseLike;
  const normalized = normalize(instruction);
  if (!normalized) return null;

  try {
    const query = db
      .from("revision_instructions")
      .select("instruction, original_content, revised_content") as SupabaseQueryLike;

    const { data, error } = await query
      .eq("project_id", projectId)
      .eq("step_type", stepType)
      .eq("page_number", pageNumber)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data?.length) return null;

    const found = data.find((row) => {
      const text = typeof row.instruction === "string" ? row.instruction : "";
      return normalize(text) === normalized;
    });

    if (!found || !found.revised_content) return null;
    return {
      originalContent:
        found.original_content &&
        typeof found.original_content === "object" &&
        !Array.isArray(found.original_content)
          ? (found.original_content as Record<string, unknown>)
          : null,
      revisedContent: found.revised_content as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}
