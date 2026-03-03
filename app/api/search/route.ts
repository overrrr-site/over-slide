import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";

const TAVILY_API_URL = "https://api.tavily.com/search";

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TAVILY_API_KEY not configured" },
      { status: 500 }
    );
  }

  const { query, maxResults = 5 } = await request.json();

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  try {
    const res = await fetch(TAVILY_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        include_answer: true,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      return NextResponse.json(
        { error: `Tavily API error: ${errorBody}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
