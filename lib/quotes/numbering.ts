type RpcError = { message?: string } | null;

type RpcClient = {
  rpc: (fn: string, params?: Record<string, unknown>) => unknown;
};

export async function generateQuoteNumber(
  supabase: RpcClient,
  teamId: string,
  targetDate?: string
): Promise<string> {
  const { data, error } = (await supabase.rpc("generate_quote_number", {
    p_team_id: teamId,
    ...(targetDate ? { p_target_date: targetDate } : {}),
  })) as { data: unknown; error: RpcError };

  if (error || typeof data !== "string" || !data) {
    throw new Error(error?.message || "見積番号の採番に失敗しました");
  }

  return data;
}
