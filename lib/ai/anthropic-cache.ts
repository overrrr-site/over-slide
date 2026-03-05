export const ANTHROPIC_PROMPT_CACHE = {
  anthropic: {
    cacheControl: {
      type: "ephemeral" as const,
    },
  },
};

export const ANTHROPIC_PROMPT_CACHE_LONG = {
  anthropic: {
    cacheControl: {
      type: "ephemeral" as const,
      ttl: "1h" as const,
    },
  },
};
