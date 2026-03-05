import type { SlideTemplate } from "../template-types";

/* ─── Content Templates ─── */

export const contentBullets: SlideTemplate = {
  id: "content-bullets",
  name: "コンテンツ：箇条書き",
  description: "タイトルバー＋箇条書きリスト。最も汎用的なレイアウト。",
  category: "content",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="caption">{{description}}</p>
  </div>
  <div class="content-area">
    <ul class="bullet-list">
      {{bullets}}
    </ul>
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "bullets", label: "箇条書き", type: "list", maxChars: 50, maxItems: 5, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 440 },
};

export const contentBulletsIcon: SlideTemplate = {
  id: "content-bullets-icon",
  name: "コンテンツ：アイコン付き箇条書き",
  description: "各項目にアイコンを添えた箇条書き。視認性が高い。",
  category: "content",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="caption">{{description}}</p>
  </div>
  <div class="content-area" style="gap:16px; display:flex; flex-direction:column;">
    {{icon_bullets}}
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    {
      name: "icon_bullets",
      label: "アイコン付き項目",
      type: "list",
      maxChars: 60,
      maxItems: 4,
      required: true,
    },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 430 },
};

export const contentBodyInfobox: SlideTemplate = {
  id: "content-body-infobox",
  name: "コンテンツ：本文＋強調ボックス",
  description: "説明文と、強調したいポイントをinfo-boxで表示。",
  category: "content",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="content-area">
    <div class="message-area">
      <p class="key-message">{{key_message}}</p>
      <p class="body-text" style="margin-bottom:20px;">{{body}}</p>
    </div>
    <div class="info-box" style="margin-top:auto;">
      <p class="body-text"><strong>{{infobox_label}}</strong> {{infobox_text}}</p>
    </div>
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "body", label: "本文", type: "text", maxChars: 150, required: true },
    { name: "infobox_label", label: "強調ラベル", type: "text", maxChars: 15, required: true },
    { name: "infobox_text", label: "強調テキスト", type: "text", maxChars: 60, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 315 },
};

export const contentTable: SlideTemplate = {
  id: "content-table",
  name: "コンテンツ：表",
  description: "タイトルバー＋データテーブル。比較や一覧表示に。",
  category: "content",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="content-area">
    <div class="message-area">
      <p class="key-message">{{key_message}}</p>
      <p class="body-text" style="margin-bottom:16px;">{{description}}</p>
    </div>
    <table class="data-table">
      {{table}}
    </table>
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "説明文", type: "text", maxChars: 80, required: false },
    { name: "table", label: "テーブル", type: "table", maxItems: 5, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 360 },
};

export const contentNumberedSteps: SlideTemplate = {
  id: "content-numbered-steps",
  name: "コンテンツ：ステップ",
  description: "番号付きリストでプロセスやステップを表示。",
  category: "content",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="caption">{{description}}</p>
  </div>
  <div class="content-area">
    <ol class="numbered-list">
      {{steps}}
    </ol>
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "steps", label: "ステップ", type: "list", maxChars: 50, maxItems: 5, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 440 },
};

/* ─── Person (migrated from person.ts → content layout) ─── */

export const contentPerson: SlideTemplate = {
  id: "content-person",
  name: "コンテンツ：人物紹介",
  description: "タイトルバー＋アバター＋名前・役職＋メッセージ。代表挨拶・メンバー紹介に。",
  category: "content",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="person-area">
    <div class="person-avatar">{{initials}}</div>
    <div class="person-info">
      <span class="person-name">{{name}}</span>
      <span class="person-role">{{role}}</span>
    </div>
  </div>
  <div class="person-message">
    <p class="body-text">{{message}}</p>
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 20, required: true },
    { name: "initials", label: "イニシャル", type: "text", maxChars: 2, required: true },
    { name: "name", label: "氏名", type: "text", maxChars: 15, required: true },
    { name: "role", label: "役職", type: "text", maxChars: 25, required: true },
    { name: "message", label: "メッセージ", type: "text", maxChars: 200, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 262 },
};

/* ─── Timeline (migrated from timeline.ts → content layout) ─── */

export const contentTimeline: SlideTemplate = {
  id: "content-timeline",
  name: "コンテンツ：タイムライン",
  description: "タイトルバー＋横方向タイムライン。沿革やロードマップに。",
  category: "content",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="caption">{{description}}</p>
  </div>
  <div class="timeline-track">
    {{timeline_nodes}}
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "timeline_nodes", label: "タイムラインノード", type: "list", maxChars: 30, maxItems: 6, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 370 },
};

/* ─── Chart (consolidated from visual.ts → content layout) ─── */

export const contentChart: SlideTemplate = {
  id: "content-chart",
  name: "コンテンツ：グラフ",
  description: "タイトルバー＋説明文＋チャートコンテナ。棒・円・折れ線グラフに。",
  category: "content",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="body-text" style="margin-bottom:12px;">{{description}}</p>
  </div>
  <div class="chart-container">
    {{chart_svg}}
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "説明文", type: "text", maxChars: 60, required: false },
    { name: "chart_svg", label: "グラフ SVG", type: "chart", required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 150 },
};

/* ─── Photo Background + Dark Overlay ─── */

export const contentPhotoBg: SlideTemplate = {
  id: "content-photo-bg",
  name: "コンテンツ：背景画像＋オーバーレイ",
  description: "全面背景写真に暗めオーバーレイをかけ、白文字でコンテンツを載せる。ビジュアルインパクトが必要なスライドに。",
  category: "content",
  html: `<div class="slide" style="padding:0;">
  <div class="slide-bg-image">
    {{image}}
  </div>
  <div class="slide-bg-overlay"></div>
  <div class="slide-bg-content">
    <div class="title-bar">
      <h2 class="slide-title">{{title}}</h2>
    </div>
    <div class="message-area">
      <p class="key-message">{{key_message}}</p>
      <p class="caption">{{description}}</p>
    </div>
    <div class="content-area">
      <ul class="bullet-list">
        {{bullets}}
      </ul>
    </div>
    <span class="slide-number">{{page_number}}</span>
  </div>
</div>`,
  slots: [
    { name: "image", label: "背景画像プレースホルダー", type: "image", required: false },
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "bullets", label: "箇条書き", type: "list", maxChars: 40, maxItems: 4, required: false },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 350 },
};

export const contentTemplates = [
  contentBullets,
  contentBulletsIcon,
  contentBodyInfobox,
  contentTable,
  contentNumberedSteps,
  contentPerson,
  contentTimeline,
  contentChart,
  contentPhotoBg,
];
