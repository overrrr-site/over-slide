export const REQUEST_FINGERPRINT_VERSION = "v1";

export interface CacheUsageMetadata {
  cacheHit: boolean;
  cacheLayer: string;
  cacheKeyPrefix: string | null;
  cacheReadInputTokens: number | null;
  cacheCreationInputTokens: number | null;
  requestFingerprintVersion: string;
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function extractAnthropicCacheMetrics(providerMetadata: unknown): {
  cacheReadInputTokens: number | null;
  cacheCreationInputTokens: number | null;
} {
  const root = asRecord(providerMetadata);
  const anthropic = asRecord(root?.anthropic);

  const cacheReadInputTokens =
    toFiniteNumber(anthropic?.cacheReadInputTokens) ??
    toFiniteNumber(anthropic?.cache_read_input_tokens) ??
    null;

  const cacheCreationInputTokens =
    toFiniteNumber(anthropic?.cacheCreationInputTokens) ??
    toFiniteNumber(anthropic?.cache_creation_input_tokens) ??
    null;

  return {
    cacheReadInputTokens,
    cacheCreationInputTokens,
  };
}

export function buildStandardCacheMetadata(
  metadata: Record<string, unknown> = {}
): CacheUsageMetadata & Record<string, unknown> {
  const cacheHitRaw = metadata.cacheHit;
  const cacheLayerRaw = metadata.cacheLayer;
  const cacheKeyPrefixRaw = metadata.cacheKeyPrefix;

  return {
    ...metadata,
    cacheHit: typeof cacheHitRaw === "boolean" ? cacheHitRaw : false,
    cacheLayer: typeof cacheLayerRaw === "string" ? cacheLayerRaw : "none",
    cacheKeyPrefix:
      typeof cacheKeyPrefixRaw === "string" && cacheKeyPrefixRaw.length > 0
        ? cacheKeyPrefixRaw
        : null,
    cacheReadInputTokens: toFiniteNumber(metadata.cacheReadInputTokens),
    cacheCreationInputTokens: toFiniteNumber(metadata.cacheCreationInputTokens),
    requestFingerprintVersion:
      typeof metadata.requestFingerprintVersion === "string"
        ? metadata.requestFingerprintVersion
        : REQUEST_FINGERPRINT_VERSION,
  };
}
