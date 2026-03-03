"use client";

import { useCallback } from "react";

type AbortableAction<T> = (signal: AbortSignal) => Promise<T>;

export function useAbortableAction() {
  const runWithTimeout = useCallback(
    async <T>(action: AbortableAction<T>, timeoutMs: number): Promise<T> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        return await action(controller.signal);
      } finally {
        clearTimeout(timeout);
      }
    },
    []
  );

  return { runWithTimeout };
}
