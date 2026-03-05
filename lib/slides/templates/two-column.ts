import type { SlideTemplate } from "../template-types";

/* ─── Two-Column Templates ─── */

export const twoColComparison: SlideTemplate = {
  id: "twocol-comparison",
  name: "2カラム：対比",
  description: "現状vs提案、Before/Afterなどの対比レイアウト。",
  category: "two-column",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="caption">{{description}}</p>
  </div>
  <div class="grid-2col">
    <div>
      <h3 style="font-size:16px; font-weight:700; color:var(--navy); margin-bottom:12px;">{{left_heading}}</h3>
      <ul class="bullet-list">
        {{left_bullets}}
      </ul>
    </div>
    <div>
      <h3 style="font-size:16px; font-weight:700; color:var(--green); margin-bottom:12px;">{{right_heading}}</h3>
      <ul class="bullet-list">
        {{right_bullets}}
      </ul>
    </div>
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "left_heading", label: "左見出し", type: "text", maxChars: 15, required: true },
    { name: "left_bullets", label: "左箇条書き", type: "list", maxChars: 40, maxItems: 4, required: true },
    { name: "right_heading", label: "右見出し", type: "text", maxChars: 15, required: true },
    { name: "right_bullets", label: "右箇条書き", type: "list", maxChars: 40, maxItems: 4, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 540 },
};

export const twoColFeatureGrid: SlideTemplate = {
  id: "twocol-feature-grid",
  name: "2カラム：特長グリッド",
  description: "アイコン付きの特長を2列で並べるレイアウト。",
  category: "two-column",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="caption">{{description}}</p>
  </div>
  <div class="grid-2col" style="gap:24px;">
    {{feature_cards}}
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    {
      name: "feature_cards",
      label: "特長カード（4つ）",
      type: "list",
      maxChars: 50,
      maxItems: 4,
      required: true,
    },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 390 },
};

/* ─── Text + Media (merged from twocol-text-visual + twocol-text-image) ─── */

export const twoColTextMedia: SlideTemplate = {
  id: "twocol-text-media",
  name: "2カラム：テキスト＋メディア",
  description: "左にテキスト・箇条書き、右にメディア（画像・グラフ等）。最も汎用的な2カラム。",
  category: "two-column",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="grid-2col" style="align-items:center;">
    <div>
      <p class="body-text" style="margin-bottom:16px;">{{body}}</p>
      <ul class="bullet-list">
        {{bullets}}
      </ul>
    </div>
    <div class="chart-container" style="background:var(--white); border-radius:12px; border:1px solid var(--beige); min-height:280px;">
      {{media}}
    </div>
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "body", label: "本文", type: "text", maxChars: 100, required: false },
    { name: "bullets", label: "箇条書き", type: "list", maxChars: 40, maxItems: 4, required: false },
    { name: "media", label: "メディア（画像テキスト or SVGチャート）", type: "chart", required: false },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 300 },
};

/* ─── Media + Text (reversed layout) ─── */

export const twoColMediaText: SlideTemplate = {
  id: "twocol-media-text",
  name: "2カラム：メディア＋テキスト",
  description: "左にメディア（画像・グラフ等）、右にテキスト・箇条書き。ビジュアル先行の紹介に。",
  category: "two-column",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="grid-2col" style="align-items:center;">
    <div class="chart-container" style="background:var(--white); border-radius:12px; border:1px solid var(--beige); min-height:280px;">
      {{media}}
    </div>
    <div>
      <p class="body-text" style="margin-bottom:16px;">{{body}}</p>
      <ul class="bullet-list">
        {{bullets}}
      </ul>
    </div>
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "media", label: "メディア（画像テキスト or SVGチャート）", type: "chart", required: false },
    { name: "body", label: "本文", type: "text", maxChars: 100, required: false },
    { name: "bullets", label: "箇条書き", type: "list", maxChars: 40, maxItems: 4, required: false },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 300 },
};

/* ─── Statement (migrated from statement.ts → two-column layout) ─── */

export const twoColStatement: SlideTemplate = {
  id: "twocol-statement",
  name: "2カラム：ステートメント＋説明",
  description: "左に大きなステートメント、右に説明文。ビジョン解説に。",
  category: "two-column",
  html: `<div class="slide">
  <p class="statement-label">{{label}}</p>
  <div class="grid-2col" style="align-items:center;">
    <div>
      <p class="statement-text">{{statement}}</p>
    </div>
    <div>
      <p class="body-text">{{description}}</p>
    </div>
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "label", label: "ラベル", type: "text", maxChars: 15, required: true },
    { name: "statement", label: "ステートメント", type: "text", maxChars: 60, required: true },
    { name: "description", label: "説明文", type: "text", maxChars: 150, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 225 },
};

export const twoColumnTemplates = [
  twoColComparison,
  twoColFeatureGrid,
  twoColTextMedia,
  twoColMediaText,
  twoColStatement,
];
