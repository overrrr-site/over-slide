import { createHash } from "crypto";
import { generateObject, generateText } from "ai";
import type { LanguageModelUsage, ProviderMetadata } from "ai";
import {
  REQUEST_FINGERPRINT_VERSION,
} from "@/lib/ai/cache-metadata";
import {
  buildSemanticCacheKey,
  getCachedText,
  setCachedText,
} from "@/lib/ai/semantic-cache";

const DEFAULT_CACHE_TTL_HOURS = 72;
const CACHE_LAYER = "semantic-db";

type GenerateTextCall = Parameters<typeof generateText>[0];

interface CachedCallBase {
  supabase: unknown;
  teamId: string | null | undefined;
  endpoint: string;
  modelName: string;
  cacheTtlHours?: number;
  cacheKeyPayload?: unknown;
  cacheMetadata?: Record<string, unknown>;
}

export interface CachedGenerateTextParams extends CachedCallBase {
  model: GenerateTextCall["model"];
  system?: GenerateTextCall["system"];
  prompt?: GenerateTextCall["prompt"];
  messages?: GenerateTextCall["messages"];
  maxOutputTokens?: GenerateTextCall["maxOutputTokens"];
  abortSignal?: GenerateTextCall["abortSignal"];
  providerOptions?: GenerateTextCall["providerOptions"];
}

export interface CachedGenerateTextResult {
  text: string;
  usage?: LanguageModelUsage;
  providerMetadata?: ProviderMetadata;
  cacheHit: boolean;
  cacheLayer: string;
  cacheKeyPrefix: string;
  requestFingerprintVersion: string;
}

export interface CachedGenerateObjectParams<OBJECT> extends CachedCallBase {
  model: GenerateTextCall["model"];
  schema: unknown;
  system?: GenerateTextCall["system"];
  prompt?: GenerateTextCall["prompt"];
  messages?: GenerateTextCall["messages"];
  maxOutputTokens?: GenerateTextCall["maxOutputTokens"];
  abortSignal?: GenerateTextCall["abortSignal"];
  providerOptions?: GenerateTextCall["providerOptions"];
  validateCachedObject?: (value: unknown) => OBJECT;
}

export interface CachedGenerateObjectResult<OBJECT> {
  object: OBJECT;
  usage?: LanguageModelUsage;
  providerMetadata?: ProviderMetadata;
  cacheHit: boolean;
  cacheLayer: string;
  cacheKeyPrefix: string;
  requestFingerprintVersion: string;
}

function canUseCache(
  supabase: unknown,
  teamId: string | null | undefined
): teamId is string {
  return Boolean(supabase && typeof supabase === "object" && teamId);
}

function safeStringify(value: unknown): string {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? serialized : String(value ?? "");
  } catch {
    return String(value ?? "");
  }
}

function buildRequestFingerprint(payload: unknown): string {
  return createHash("sha256").update(safeStringify(payload)).digest("hex");
}

function buildCacheIdentity(params: {
  endpoint: string;
  modelName: string;
  requestPayload: unknown;
}): {
  cacheKey: string;
  cacheKeyPrefix: string;
  strictFingerprint: string;
} {
  const strictFingerprint = buildRequestFingerprint(params.requestPayload);
  const cacheKey = buildSemanticCacheKey({
    endpoint: params.endpoint,
    model: params.modelName,
    requestFingerprintVersion: REQUEST_FINGERPRINT_VERSION,
    strictFingerprint,
  });

  return {
    cacheKey,
    cacheKeyPrefix: cacheKey.slice(0, 12),
    strictFingerprint,
  };
}

function parseCachedObject<OBJECT>(
  text: string,
  params: Pick<CachedGenerateObjectParams<OBJECT>, "schema" | "validateCachedObject">
): OBJECT {
  const parsed = JSON.parse(text) as unknown;

  if (params.validateCachedObject) {
    return params.validateCachedObject(parsed);
  }

  const schema = params.schema as {
    parse?: (value: unknown) => OBJECT;
    safeParse?: (value: unknown) =>
      | { success: true; data: OBJECT }
      | { success: false };
  };

  if (typeof schema?.parse === "function") {
    return schema.parse(parsed);
  }

  if (typeof schema?.safeParse === "function") {
    const result = schema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    throw new Error("Cached object validation failed");
  }

  return parsed as OBJECT;
}

export async function cachedGenerateText({
  supabase,
  teamId,
  endpoint,
  modelName,
  model,
  system,
  prompt,
  messages,
  maxOutputTokens,
  abortSignal,
  providerOptions,
  cacheTtlHours = DEFAULT_CACHE_TTL_HOURS,
  cacheKeyPayload,
  cacheMetadata = {},
}: CachedGenerateTextParams): Promise<CachedGenerateTextResult> {
  const requestPayload =
    cacheKeyPayload ??
    ({
      system,
      prompt,
      messages,
      maxOutputTokens,
      providerOptions,
    } as const);

  const { cacheKey, cacheKeyPrefix, strictFingerprint } = buildCacheIdentity({
    endpoint,
    modelName,
    requestPayload,
  });

  if (canUseCache(supabase, teamId)) {
    const cached = await getCachedText({
      supabase,
      teamId,
      endpoint,
      model: modelName,
      cacheKey,
    });

    if (cached) {
      return {
        text: cached.text,
        usage: undefined,
        providerMetadata: undefined,
        cacheHit: true,
        cacheLayer: CACHE_LAYER,
        cacheKeyPrefix,
        requestFingerprintVersion: REQUEST_FINGERPRINT_VERSION,
      };
    }
  }

  const generated = await generateText({
    model,
    ...(system !== undefined ? { system } : {}),
    ...(messages !== undefined
      ? { messages }
      : prompt !== undefined
        ? { prompt }
        : {}),
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    ...(abortSignal !== undefined ? { abortSignal } : {}),
    ...(providerOptions !== undefined ? { providerOptions } : {}),
  } as never);

  if (canUseCache(supabase, teamId)) {
    await setCachedText({
      supabase,
      teamId,
      endpoint,
      model: modelName,
      cacheKey,
      text: generated.text,
      usage: generated.usage,
      metadata: {
        ...cacheMetadata,
        strictFingerprint,
        requestFingerprintVersion: REQUEST_FINGERPRINT_VERSION,
      },
      ttlHours: cacheTtlHours,
    });
  }

  return {
    text: generated.text,
    usage: generated.usage,
    providerMetadata: generated.providerMetadata,
    cacheHit: false,
    cacheLayer: CACHE_LAYER,
    cacheKeyPrefix,
    requestFingerprintVersion: REQUEST_FINGERPRINT_VERSION,
  };
}

export async function cachedGenerateObject<OBJECT>({
  supabase,
  teamId,
  endpoint,
  modelName,
  model,
  schema,
  system,
  prompt,
  messages,
  maxOutputTokens,
  abortSignal,
  providerOptions,
  cacheTtlHours = DEFAULT_CACHE_TTL_HOURS,
  cacheKeyPayload,
  cacheMetadata = {},
  validateCachedObject,
}: CachedGenerateObjectParams<OBJECT>): Promise<CachedGenerateObjectResult<OBJECT>> {
  const requestPayload =
    cacheKeyPayload ??
    ({
      system,
      prompt,
      messages,
      maxOutputTokens,
      providerOptions,
    } as const);

  const { cacheKey, cacheKeyPrefix, strictFingerprint } = buildCacheIdentity({
    endpoint,
    modelName,
    requestPayload,
  });

  if (canUseCache(supabase, teamId)) {
    const cached = await getCachedText({
      supabase,
      teamId,
      endpoint,
      model: modelName,
      cacheKey,
    });

    if (cached) {
      try {
        const object = parseCachedObject<OBJECT>(cached.text, {
          schema,
          validateCachedObject,
        });

        return {
          object,
          usage: undefined,
          providerMetadata: undefined,
          cacheHit: true,
          cacheLayer: CACHE_LAYER,
          cacheKeyPrefix,
          requestFingerprintVersion: REQUEST_FINGERPRINT_VERSION,
        };
      } catch {
        // Cache record is stale or incompatible; regenerate and overwrite.
      }
    }
  }

  const generated = (await generateObject({
    model,
    schema: schema as never,
    ...(system !== undefined ? { system } : {}),
    ...(messages !== undefined
      ? { messages }
      : prompt !== undefined
        ? { prompt }
        : {}),
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    ...(abortSignal !== undefined ? { abortSignal } : {}),
    ...(providerOptions !== undefined ? { providerOptions } : {}),
  } as never)) as {
    object: OBJECT;
    usage?: LanguageModelUsage;
    providerMetadata?: ProviderMetadata;
  };

  if (canUseCache(supabase, teamId)) {
    await setCachedText({
      supabase,
      teamId,
      endpoint,
      model: modelName,
      cacheKey,
      text: safeStringify(generated.object),
      usage: generated.usage,
      metadata: {
        ...cacheMetadata,
        strictFingerprint,
        requestFingerprintVersion: REQUEST_FINGERPRINT_VERSION,
      },
      ttlHours: cacheTtlHours,
    });
  }

  return {
    object: generated.object,
    usage: generated.usage,
    providerMetadata: generated.providerMetadata,
    cacheHit: false,
    cacheLayer: CACHE_LAYER,
    cacheKeyPrefix,
    requestFingerprintVersion: REQUEST_FINGERPRINT_VERSION,
  };
}
