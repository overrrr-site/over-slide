import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { profile } = auth;

  // Check if user is admin
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  const admin = createAdminClient();
  const { error } = await admin.from("invitations").insert({
    team_id: profile.team_id,
    email,
    token,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const signupUrl = `${request.nextUrl.origin}/signup?token=${token}`;

  return NextResponse.json({ signupUrl, token });
}
