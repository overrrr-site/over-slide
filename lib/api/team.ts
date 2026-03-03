import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function getTeamIdForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", userId)
    .single();

  return typeof profile?.team_id === "string" ? profile.team_id : null;
}
