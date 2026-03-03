"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QuoteForm } from "../new/page";
import type { Quote, QuoteItem } from "@/lib/quotes/types";

export default function QuoteEditPage() {
  const params = useParams();
  const quoteId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);

  useEffect(() => {
    fetch(`/api/quotes/${quoteId}`)
      .then((res) => {
        if (!res.ok) throw new Error("見積が見つかりません");
        return res.json();
      })
      .then((data) => {
        setQuote(data.quote);
        setItems(data.items || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [quoteId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-secondary">読み込み中...</p>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-500">{error || "見積が見つかりません"}</p>
          <Link
            href="/quotes"
            className="mt-2 inline-block text-sm text-navy underline hover:no-underline"
          >
            一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <QuoteForm
      quoteId={quoteId}
      initialQuote={quote}
      initialItems={items}
    />
  );
}
