"use client";

import { useSyncExternalStore } from "react";
import { QuoteForm } from "./quote-form";

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export default function QuoteNewPage() {
  const isClient = useIsClient();

  if (!isClient) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-secondary">読み込み中...</p>
      </div>
    );
  }

  return <QuoteForm />;
}
