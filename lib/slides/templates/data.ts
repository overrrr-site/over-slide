import type { SlideTemplate } from "../template-types";

/* ─── Data / KPI Templates ─── */

export const dataKpi3: SlideTemplate = {
  id: "data-kpi-3",
  name: "KPI：3カード",
  description: "3つのKPIカードを横並び＋補足テキスト。バランスの良い定番レイアウト。",
  category: "data",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="caption">{{description}}</p>
  </div>
  <div class="kpi-grid" data-count="3">
    {{kpi_cards}}
  </div>
  <p class="caption" style="margin-top:16px; text-align:center;">{{footnote}}</p>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "kpi_cards", label: "KPIカード", type: "kpi", maxItems: 3, required: true },
    { name: "footnote", label: "脚注", type: "text", maxChars: 80, required: false },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 390 },
};

export const dataKpi2: SlideTemplate = {
  id: "data-kpi-2",
  name: "KPI：2カード大",
  description: "2つのKPIを大きく表示＋補足テキスト。インパクトのある数値強調に。",
  category: "data",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="caption">{{description}}</p>
  </div>
  <div class="kpi-grid" data-count="2">
    {{kpi_cards}}
  </div>
  <p class="caption" style="margin-top:16px; text-align:center;">{{footnote}}</p>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "kpi_cards", label: "KPIカード", type: "kpi", maxItems: 2, required: true },
    { name: "footnote", label: "脚注", type: "text", maxChars: 80, required: false },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 340 },
};

export const dataKpi4: SlideTemplate = {
  id: "data-kpi-4",
  name: "KPI：4カード",
  description: "4つのKPIカードをコンパクトに並べる＋補足テキスト。多くの指標を一覧するとき。",
  category: "data",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="caption">{{description}}</p>
  </div>
  <div class="kpi-grid" data-count="4">
    {{kpi_cards}}
  </div>
  <p class="caption" style="margin-top:16px; text-align:center;">{{footnote}}</p>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "kpi_cards", label: "KPIカード", type: "kpi", maxItems: 4, required: true },
    { name: "footnote", label: "脚注", type: "text", maxChars: 80, required: false },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 430 },
};

export const dataHighlightSingle: SlideTemplate = {
  id: "data-highlight-single",
  name: "数値ハイライト：単一",
  description: "1つの大きな数値を中央に。最もインパクトの強い数値表現。",
  category: "data",
  html: `<div class="slide flex-col-center" style="text-align:center; gap:8px;">
  <p class="caption" style="font-size:14px; margin-bottom:8px;">{{context}}</p>
  <div class="kpi-value" style="font-size:72px; color:var(--navy);">{{value}}</div>
  <p class="body-text" style="font-size:16px; font-weight:500; margin-top:4px;">{{label}}</p>
  <p class="caption" style="max-width:720px; margin-top:16px;">{{description}}</p>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "context", label: "前振り", type: "text", maxChars: 30, required: false },
    { name: "value", label: "数値", type: "text", maxChars: 10, required: true },
    { name: "label", label: "ラベル", type: "text", maxChars: 20, required: true },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 160 },
};

export const dataTemplates = [dataKpi3, dataKpi2, dataKpi4, dataHighlightSingle];
