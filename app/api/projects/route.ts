import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";

export async function GET() {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase } = auth;

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, user, profile } = auth;

  const body = await request.json().catch(() => ({}));
  if (!body.allowDirectCreate) {
    return NextResponse.json(
      { error: "Project creation must start from brainstorm handoff" },
      { status: 400 }
    );
  }
  const { title, clientName, outputType } = body;

  const { data, error } = await supabase
    .from("projects")
    .insert({
      team_id: profile.team_id,
      created_by: user.id,
      title: title || "新しいプロジェクト",
      client_name: clientName || "",
      output_type: outputType === "document" ? "document" : "slide",
      status: "draft",
      current_step: 1,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
