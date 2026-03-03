"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildSingleSlideDocument } from "@/lib/slides/base-styles";

interface ColorScheme {
  navy: string;
  green: string;
  beige: string;
  offWhite: string;
  textPrimary: string;
  textSecondary: string;
  white: string;
}

const DEFAULT_COLORS: ColorScheme = {
  navy: "1A2B4A",
  green: "6B8E7F",
  beige: "E8D5C4",
  offWhite: "F9F7F4",
  textPrimary: "2A2A2A",
  textSecondary: "666666",
  white: "FFFFFF",
};

const COLOR_LABELS: Record<keyof ColorScheme, string> = {
  navy: "メインカラー（ネイビー）",
  green: "アクセントカラー（グリーン）",
  beige: "サブカラー（ベージュ）",
  offWhite: "背景色",
  textPrimary: "本文テキスト",
  textSecondary: "補足テキスト",
  white: "白（カード背景）",
};

const FONT_INFO = {
  japanese: "Zen Kaku Gothic New",
  english: "Montserrat",
  fallback: "Arial",
};

/** Preview slide HTML */
function buildPreviewHtml(): string {
  return `
<div class="slide" style="padding:32px 40px;">
  <div class="title-bar">
    <h2 class="slide-title" style="font-size:18px;">プレビュー：スライドデザイン</h2>
  </div>
  <div class="grid-2col" style="gap:20px;">
    <div>
      <ul class="bullet-list" style="font-size:12px;">
        <li>メインカラーのタイトルバー</li>
        <li>アクセントカラーのブレット</li>
        <li>ベージュのテーブル罫線</li>
      </ul>
      <div class="info-box" style="margin-top:12px; padding:10px 14px;">
        <p class="body-text" style="font-size:11px;"><strong>ポイント:</strong> カラー設定はスライド全体に反映されます</p>
      </div>
    </div>
    <div>
      <div class="kpi-grid" data-count="2" style="gap:12px;">
        <div class="kpi-card kpi-card--navy" style="padding:14px 10px;">
          <div class="kpi-value" style="font-size:28px;">85%</div>
          <div class="kpi-label" style="font-size:10px;">完成度</div>
        </div>
        <div class="kpi-card kpi-card--green" style="padding:14px 10px;">
          <div class="kpi-value" style="font-size:28px;">120</div>
          <div class="kpi-label" style="font-size:10px;">実績</div>
        </div>
      </div>
    </div>
  </div>
  <span class="slide-number" style="font-size:8px;">1</span>
</div>`;
}

export default function SettingsPage() {
  const [colors, setColors] = useState<ColorScheme>(DEFAULT_COLORS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);

  // Load existing settings
  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("id", user.id)
        .single();

      if (!profile?.team_id) {
        setLoading(false);
        return;
      }
      setTeamId(profile.team_id);

      const { data: settings } = await supabase
        .from("template_settings")
        .select("color_scheme")
        .eq("team_id", profile.team_id)
        .single();

      if (settings?.color_scheme) {
        setColors(settings.color_scheme as ColorScheme);
      }
      setLoading(false);
    };
    load();
  }, []);

  const updateColor = (key: keyof ColorScheme, hex: string) => {
    // Remove # prefix if present
    const value = hex.replace(/^#/, "");
    setColors((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const resetToDefaults = () => {
    setColors(DEFAULT_COLORS);
    setSaved(false);
  };

  const saveSettings = async () => {
    if (!teamId) return;
    setSaving(true);

    const supabase = createClient();
    await supabase.from("template_settings").upsert(
      {
        team_id: teamId,
        color_scheme: colors,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id" }
    );

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Build preview with custom colors injected
  const previewSrcDoc = useMemo(() => {
    const previewHtml = buildPreviewHtml();
    const doc = buildSingleSlideDocument(previewHtml, {
      navy: colors.navy,
      green: colors.green,
      beige: colors.beige,
      offWhite: colors.offWhite,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      white: colors.white,
    });
    return doc;
  }, [colors]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-navy border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy">テンプレート設定</h1>
          <p className="text-xs text-text-secondary">
            スライドのカラーテーマをカスタマイズできます
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Color pickers */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-navy">カラースキーム</h3>
            <div className="space-y-3">
              {(Object.keys(COLOR_LABELS) as (keyof ColorScheme)[]).map(
                (key) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 rounded-lg border border-beige bg-white p-4"
                  >
                    <input
                      type="color"
                      value={`#${colors[key]}`}
                      onChange={(e) => updateColor(key, e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border border-beige"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-navy">
                        {COLOR_LABELS[key]}
                      </p>
                      <p className="text-xs text-text-secondary">
                        #{colors[key]}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Font display (read-only) */}
            <h3 className="mt-6 text-sm font-bold text-navy">
              フォント設定（読み取り専用）
            </h3>
            <div className="space-y-2">
              <div className="rounded-lg border border-beige bg-white p-4">
                <p className="text-xs text-text-secondary">日本語フォント</p>
                <p
                  className="text-sm font-medium text-navy"
                  style={{ fontFamily: FONT_INFO.japanese }}
                >
                  {FONT_INFO.japanese}
                </p>
              </div>
              <div className="rounded-lg border border-beige bg-white p-4">
                <p className="text-xs text-text-secondary">英語フォント</p>
                <p
                  className="text-sm font-medium text-navy"
                  style={{ fontFamily: FONT_INFO.english }}
                >
                  {FONT_INFO.english}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={saveSettings}
                disabled={saving || !teamId}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
              >
                {saving ? "保存中..." : saved ? "✓ 保存しました" : "保存"}
              </button>
              <button
                onClick={resetToDefaults}
                className="rounded-lg border border-beige bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-off-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
              >
                デフォルトに戻す
              </button>
            </div>
          </div>

          {/* Preview */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-navy">プレビュー</h3>
            <div className="overflow-hidden rounded-lg border border-beige bg-gray-50">
              <div className="relative aspect-[16/9]">
                <iframe
                  srcDoc={previewSrcDoc}
                  title="スライドプレビュー"
                  sandbox="allow-same-origin"
                  className="pointer-events-none absolute inset-0"
                  style={{
                    width: "960px",
                    height: "540px",
                    border: "none",
                  }}
                  ref={(el) => {
                    if (el) {
                      const parent = el.parentElement;
                      if (parent) {
                        const observer = new ResizeObserver(() => {
                          const scale = parent.clientWidth / 960;
                          el.style.transform = `scale(${scale})`;
                          el.style.transformOrigin = "top left";
                          parent.style.height = `${540 * scale}px`;
                        });
                        observer.observe(parent);
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
