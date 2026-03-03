"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewBrainstormPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const createBrainstorm = async () => {
      const res = await fetch("/api/brainstorms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        if (!cancelled) {
          setErrorMessage(error.error || "ブレスト作成に失敗しました。");
        }
        return;
      }

      const data = await res.json();
      if (!cancelled && data.id) {
        router.replace(`/brainstorms/${data.id}`);
      }
    };

    createBrainstorm();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex h-full items-center justify-center">
      {errorMessage ? (
        <div className="max-w-lg rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">ブレスト作成に失敗しました</p>
          <p className="mt-1">{errorMessage}</p>
          <button
            onClick={() => router.replace("/brainstorms")}
            className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
          >
            ブレスト一覧へ戻る
          </button>
        </div>
      ) : (
        <p className="text-sm text-text-secondary">ブレストを作成しています...</p>
      )}
    </div>
  );
}
