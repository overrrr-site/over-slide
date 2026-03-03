import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { searchKnowledge } from "@/lib/knowledge/retriever";
import type { ChunkType } from "@/lib/knowledge/chunker";

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { profile } = auth;

  const { query, chunkTypes, limit } = await request.json();

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const results = await searchKnowledge(query, {
      teamId: profile.team_id,
      chunkTypes: chunkTypes as ChunkType[] | undefined,
      limit: limit || 5,
    });

    return NextResponse.json({ results });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
