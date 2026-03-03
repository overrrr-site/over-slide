import { createHash } from "crypto";
import type { LanguageModelUsage } from "ai";

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => SupabaseSelectQueryLike;
    upsert: (
      values: Record<string, unknown>,
      options: { onConflict: string }
    ) => PromiseLike<{ error: { message: string } | null }>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

type SupabaseSelectQueryLike = {
  eq: (column: string, value: string) => SupabaseSelectQueryLike;
  gt: (column: string, value: string) => {
    limit: (count: number) => {
      maybeSingle: () => PromiseLike<{
        data: Record<string, unknown> | null;
        error: { message: string } | null;
      }>;
    };
  };
};

type UsageLike =
  | LanguageModelUsage
  | {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      raw?: unknown;
    }
  | null
  | undefined;

export interface CacheLookupParams {
  supabase: unknown;
  teamId: string;
  endpoint: string;
  model: string;
  cacheKey: string;
}

export interface CacheStoreParams extends CacheLookupParams {
  text: string;
  usage?: UsageLike;
  metadata?: Record<string, unknown>;
  ttlHours?: number;
}

export interface CachedText {
  text: string;
  usage: UsageLike;
}

function normalizeString(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeValue(value: unknown): unknown {
  if (value == null) return value;

  if (typeof value === "string") {
    return normalizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sortedEntries = Object.entries(obj)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => [key, normalizeValue(entryValue)]);
    return Object.fromEntries(sortedEntries);
  }

  return value;
}

export function buildSemanticCacheKey(payload: unknown): string {
  const normalized = normalizeValue(payload);
  const source = JSON.stringify(normalized);
  return createHash("sha256").update(source).digest("hex");
}

function asDb(supabase: unknown): SupabaseLike | null {
  if (!supabase || typeof supabase !== "object") return null;
  return supabase as SupabaseLike;
}

export async function getCachedText({
  supabase,
  teamId,
  endpoint,
  model,
  cacheKey,
}: CacheLookupParams): Promise<CachedText | null> {
  const db = asDb(supabase);
  if (!db) return null;

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await db
      .from("ai_response_cache")
      .select("id, response_text, usage, hit_count")
      .eq("team_id", teamId)
      .eq("endpoint", endpoint)
      .eq("model", model)
      .eq("cache_key", cacheKey)
      .gt("expires_at", nowIso)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const id = typeof data.id === "string" ? data.id : null;
    const text =
      typeof data.response_text === "string" ? data.response_text : null;
    if (!id || text == null) return null;

    const currentHitCount =
      typeof data.hit_count === "number" && Number.isFinite(data.hit_count)
        ? data.hit_count
        : 0;

    // Best-effort stats update.
    void db
      .from("ai_response_cache")
      .update({
        hit_count: currentHitCount + 1,
        last_hit_at: new Date().toISOString(),
      })
      .eq("id", id);

    return {
      text,
      usage: (data.usage as UsageLike) || null,
    };
  } catch (err) {
    console.warn("[semantic-cache] lookup failed:", err);
    return null;
  }
}

export async function setCachedText({
  supabase,
  teamId,
  endpoint,
  model,
  cacheKey,
  text,
  usage,
  metadata = {},
  ttlHours = 72,
}: CacheStoreParams): Promise<void> {
  const db = asDb(supabase);
  if (!db) return;

  try {
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const { error } = await db.from("ai_response_cache").upsert(
      {
        team_id: teamId,
        endpoint,
        model,
        cache_key: cacheKey,
        response_text: text,
        usage: usage ?? {},
        metadata,
        last_hit_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      {
        onConflict: "team_id,endpoint,model,cache_key",
      }
    );

    if (error) {
      console.warn(`[semantic-cache] upsert failed (${endpoint}): ${error.message}`);
    }
  } catch (err) {
    console.warn("[semantic-cache] store failed:", err);
  }
}
