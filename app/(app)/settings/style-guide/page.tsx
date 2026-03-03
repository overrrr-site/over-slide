"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------
interface StyleGuideData {
  id?: string;
  user_id?: string;
  composition_patterns: { text: string } | null;
  tone: { text: string } | null;
  information_density: { text: string } | null;
  phrases: { text: string } | null;
  custom_rules: string[];
}

interface CategoryConfig {
  key: keyof Pick<
    StyleGuideData,
    "composition_patterns" | "tone" | "information_density" | "phrases"
  >;
  label: string;
}

const CATEGORIES: CategoryConfig[] = [
  { key: "composition_patterns", label: "構成パターン" },
  { key: "tone", label: "文体・トーン" },
  { key: "information_density", label: "情報密度" },
  { key: "phrases", label: "よく使うフレーズ" },
];

const EMPTY_DATA: StyleGuideData = {
  composition_patterns: null,
  tone: null,
  information_density: null,
  phrases: null,
  custom_rules: [],
};

// ---------------------------------------------------------------------------
// コンポーネント
// ---------------------------------------------------------------------------
export default function StyleGuidePage() {
  const [data, setData] = useState<StyleGuideData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [newRule, setNewRule] = useState("");
  const [showRuleInput, setShowRuleInput] = useState(false);

  // -----------------------------------------------------------------------
  // データ読み込み
  // -----------------------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/style-guide");
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = await res.json();
        if (json.data) {
          setData({
            ...EMPTY_DATA,
            ...json.data,
            custom_rules: json.data.custom_rules ?? [],
          });
        }
      } catch {
        // 取得失敗時は空のままで表示
      }
      setLoading(false);
    };
    load();
  }, []);

  // -----------------------------------------------------------------------
  // 保存
  // -----------------------------------------------------------------------
  const save = useCallback(
    async (updated: StyleGuideData) => {
      setSaving(true);
      try {
        await fetch("/api/style-guide", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            composition_patterns: updated.composition_patterns,
            tone: updated.tone,
            information_density: updated.information_density,
            phrases: updated.phrases,
            custom_rules: updated.custom_rules,
          }),
        });
      } catch {
        // 保存失敗は静かに無視（次回保存で再試行）
      }
      setSaving(false);
    },
    []
  );

  // -----------------------------------------------------------------------
  // カテゴリ編集
  // -----------------------------------------------------------------------
  const startEdit = (key: string, currentText: string) => {
    setEditingKey(key);
    setDraftText(currentText);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraftText("");
  };

  const commitEdit = (key: CategoryConfig["key"]) => {
    const trimmed = draftText.trim();
    const newValue = trimmed ? { text: trimmed } : null;
    const updated = { ...data, [key]: newValue };
    setData(updated);
    setEditingKey(null);
    setDraftText("");
    save(updated);
  };

  // -----------------------------------------------------------------------
  // カスタムルール操作
  // -----------------------------------------------------------------------
  const addRule = () => {
    const trimmed = newRule.trim();
    if (!trimmed) return;
    const updated = {
      ...data,
      custom_rules: [...data.custom_rules, trimmed],
    };
    setData(updated);
    setNewRule("");
    setShowRuleInput(false);
    save(updated);
  };

  const removeRule = (index: number) => {
    const updated = {
      ...data,
      custom_rules: data.custom_rules.filter((_, i) => i !== index),
    };
    setData(updated);
    save(updated);
  };

  // -----------------------------------------------------------------------
  // 描画
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-navy border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-3xl">
        {/* ヘッダー */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy">スタイルガイド</h1>
          <p className="text-xs text-text-secondary">
            AIが解析した文体・構成の特徴を確認・編集できます
          </p>
          {saving && (
            <p className="mt-1 text-xs text-green">保存中...</p>
          )}
        </div>

        {/* カテゴリセクション */}
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const isEditing = editingKey === cat.key;
            const currentValue =
              data[cat.key] && typeof data[cat.key] === "object"
                ? (data[cat.key] as { text: string }).text
                : "";

            return (
              <div
                key={cat.key}
                className="rounded-lg border border-beige bg-white p-4"
              >
                {/* タイトル行 */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-navy">{cat.label}</h3>
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(cat.key, currentValue)}
                      className="rounded-md border border-beige px-3 py-1 text-xs text-text-primary transition-colors hover:bg-off-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
                    >
                      編集する
                    </button>
                  )}
                </div>

                {/* 内容 / 編集 */}
                {isEditing ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      onBlur={() => commitEdit(cat.key)}
                      autoFocus
                      rows={4}
                      className="w-full rounded-md border border-beige bg-off-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
                      placeholder={`${cat.label}を入力...`}
                    />
                    <div className="flex gap-2">
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          commitEdit(cat.key);
                        }}
                        className="rounded-md bg-navy px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
                      >
                        保存
                      </button>
                      <button
                        onMouseDown={(e) => {
                          e.preventDefault();
                          cancelEdit();
                        }}
                        className="rounded-md border border-beige px-3 py-1 text-xs text-text-primary transition-colors hover:bg-off-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                    {currentValue || "未設定"}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* 追加ルール */}
        <div className="mt-6 rounded-lg border border-beige bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy">
              追加ルール（手動）
            </h3>
            <button
              onClick={() => setShowRuleInput(true)}
              className="rounded-md border border-beige px-3 py-1 text-xs text-text-primary transition-colors hover:bg-off-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
            >
              ＋追加
            </button>
          </div>

          {/* ルール一覧 */}
          {data.custom_rules.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {data.custom_rules.map((rule, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-2 rounded-md bg-off-white px-3 py-2"
                >
                  <span className="text-sm text-text-primary">{rule}</span>
                  <button
                    onClick={() => removeRule(i)}
                    className="shrink-0 rounded p-0.5 text-text-secondary transition-colors hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
                    aria-label="ルールを削除"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !showRuleInput && (
              <p className="mt-2 text-sm text-text-secondary">
                追加ルールはまだありません
              </p>
            )
          )}

          {/* 新規ルール入力 */}
          {showRuleInput && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addRule();
                  if (e.key === "Escape") {
                    setShowRuleInput(false);
                    setNewRule("");
                  }
                }}
                autoFocus
                placeholder="ルールを入力..."
                className="flex-1 rounded-md border border-beige bg-off-white px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:border-green focus:outline-none focus:ring-1 focus:ring-green"
              />
              <button
                onClick={addRule}
                className="rounded-md bg-navy px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
              >
                追加
              </button>
              <button
                onClick={() => {
                  setShowRuleInput(false);
                  setNewRule("");
                }}
                className="rounded-md border border-beige px-3 py-1 text-xs text-text-primary transition-colors hover:bg-off-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2"
              >
                キャンセル
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
