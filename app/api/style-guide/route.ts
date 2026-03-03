import { NextRequest, NextResponse } from "next/server";
import { requireAuthJson } from "@/lib/api/auth";
import { STYLE_GUIDE_PRESET } from "@/lib/style-guide/defaults";

/**
 * GET /api/style-guide
 * 現在ログインしているユーザーのスタイルガイドを取得する。
 * まだ作成されていない場合はプリセットを自動作成して返す。
 */
export async function GET() {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, user } = auth;

  const { data, error } = await supabase
    .from("style_guide")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: `取得に失敗しました: ${error.message}` },
      { status: 500 }
    );
  }

  // データがなければプリセットを自動作成
  if (!data) {
    const { data: created, error: createErr } = await supabase
      .from("style_guide")
      .insert({
        user_id: user.id,
        ...STYLE_GUIDE_PRESET,
      })
      .select()
      .single();

    if (createErr) {
      // 作成失敗時はプリセット内容をそのまま返す（DB保存なし）
      return NextResponse.json({
        data: { user_id: user.id, ...STYLE_GUIDE_PRESET },
      });
    }

    return NextResponse.json({ data: created });
  }

  return NextResponse.json({ data });
}

/**
 * PUT /api/style-guide
 * スタイルガイドを更新（なければ作成）する。
 *
 * Body:
 *   composition_patterns?: object | null
 *   tone?: object | null
 *   information_density?: object | null
 *   phrases?: object | null
 *   custom_rules?: string[]
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuthJson();
  if (auth instanceof Response) {
    return auth;
  }
  const { supabase, user } = auth;

  const body = await request.json();

  const fields = {
    user_id: user.id,
    composition_patterns: body.composition_patterns ?? null,
    tone: body.tone ?? null,
    information_density: body.information_density ?? null,
    phrases: body.phrases ?? null,
    custom_rules: body.custom_rules ?? [],
    updated_at: new Date().toISOString(),
  };

  // upsert (user_id にユニークインデックスあり)
  const { data, error } = await supabase
    .from("style_guide")
    .upsert(fields, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: `保存に失敗しました: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}
