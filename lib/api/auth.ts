import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AuthContext = {
  supabase: SupabaseClient;
  user: User;
  profile: { team_id: string; role: string };
};

/**
 * Ensure a profile (and default team) exists for the authenticated user.
 * Calls the DB function ensure_user_profile() which is SECURITY DEFINER,
 * so it safely creates a team + profile if missing.
 *
 * Returns { team_id, role } or null on failure.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  user: User
): Promise<{ team_id: string; role: string } | null> {
  // Fast path: profile already exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("team_id, role")
    .eq("id", user.id)
    .single();

  if (existing) {
    return existing as { team_id: string; role: string };
  }

  // Provision via RPC (SECURITY DEFINER — bypasses RLS)
  const { data: teamId, error: rpcError } = await supabase.rpc(
    "ensure_user_profile"
  );

  if (rpcError || !teamId) {
    console.warn(
      "[ensureProfile] RPC ensure_user_profile failed:",
      rpcError?.message
    );
    return null;
  }

  // Re-fetch the freshly created profile
  const { data: fresh } = await supabase
    .from("profiles")
    .select("team_id, role")
    .eq("id", user.id)
    .single();

  return (fresh as { team_id: string; role: string }) ?? null;
}

/**
 * Require authentication AND a valid profile.
 * Auto-provisions team + profile if missing (after db reset, etc.).
 */
export async function requireAuth(): Promise<AuthContext | Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const profile = await ensureProfile(supabase, user);
  if (!profile) {
    return new Response("Failed to provision user profile", { status: 500 });
  }

  return { supabase, user, profile };
}

function authErrorToJson(response: Response): Response {
  const message =
    response.status === 401 ? "Unauthorized" : "Failed to provision profile";
  return Response.json({ error: message }, { status: response.status });
}

/**
 * Require authentication and always return JSON error payloads on failure.
 * Use this from NextResponse.json based API routes.
 */
export async function requireAuthJson(): Promise<AuthContext | Response> {
  const auth = await requireAuth();
  if (auth instanceof Response) {
    return authErrorToJson(auth);
  }
  return auth;
}
