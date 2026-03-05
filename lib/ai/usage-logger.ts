import type { LanguageModelUsage } from "ai";
import { buildStandardCacheMetadata } from "@/lib/ai/cache-metadata";

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        single: () => PromiseLike<{
          data: Record<string, unknown> | null;
          error: { message: string } | null;
        }>;
      };
    };
    insert: (
      values: Record<string, unknown>
    ) => PromiseLike<{ error: { message: string } | null }>;
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

export interface RecordAiUsageParams {
  supabase: unknown;
  endpoint: string;
  operation: "generateText" | "streamText";
  model: string;
  userId: string;
  projectId?: string | null;
  teamId?: string | null;
  promptChars?: number;
  completionChars?: number;
  usage?: UsageLike;
  metadata?: Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function inferProvider(model: string): string {
  const name = model.toLowerCase();
  if (name.includes("claude") || name.includes("anthropic")) return "anthropic";
  if (name.includes("gemini") || name.includes("google")) return "google";
  if (name.includes("gpt") || name.includes("openai")) return "openai";
  return "unknown";
}

async function resolveTeamId(
  supabase: SupabaseLike,
  userId: string,
  projectId?: string | null,
  teamId?: string | null
): Promise<string | null> {
  if (teamId) return teamId;

  if (projectId) {
    const { data } = await supabase
      .from("projects")
      .select("team_id")
      .eq("id", projectId)
      .single();

    if (data?.team_id && typeof (data as Record<string, unknown>).team_id === "string") {
      return (data as Record<string, string>).team_id;
    }
  }

  const { data } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", userId)
    .single();

  if (data?.team_id && typeof (data as Record<string, unknown>).team_id === "string") {
    return (data as Record<string, string>).team_id;
  }

  return null;
}

export async function recordAiUsage({
  supabase,
  endpoint,
  operation,
  model,
  userId,
  projectId = null,
  teamId = null,
  promptChars,
  completionChars,
  usage,
  metadata = {},
}: RecordAiUsageParams): Promise<void> {
  try {
    if (!supabase || typeof supabase !== "object") return;
    const db = supabase as SupabaseLike;
    const resolvedTeamId = await resolveTeamId(db, userId, projectId, teamId);
    if (!resolvedTeamId) return;

    const inputTokens = asNumber(usage?.inputTokens);
    const outputTokens = asNumber(usage?.outputTokens);
    const totalTokens = asNumber(usage?.totalTokens);

    const normalizedMetadata = buildStandardCacheMetadata(metadata);

    const payload = {
      team_id: resolvedTeamId,
      user_id: userId,
      project_id: projectId,
      endpoint,
      operation,
      model,
      provider: inferProvider(model),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      prompt_chars: asNumber(promptChars),
      completion_chars: asNumber(completionChars),
      request_metadata: normalizedMetadata,
    };

    const { error } = await db.from("ai_usage_logs").insert(payload);
    if (error) {
      console.warn(`[ai-usage] Failed to insert usage log (${endpoint}): ${error.message}`);
    }
  } catch (err) {
    console.warn(`[ai-usage] Unexpected error (${endpoint}):`, err);
  }
}
