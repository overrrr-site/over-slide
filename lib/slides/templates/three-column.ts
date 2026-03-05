import type { SlideTemplate } from "../template-types";

/* ─── Three-Column Templates ─── */

export const threecolNumberedCards: SlideTemplate = {
  id: "threecol-numbered-cards",
  name: "3カラム：番号付きカード",
  description: "番号付き3カラムカード＋結論文。3つのポイント提示に最適。",
  category: "three-column",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="caption">{{description}}</p>
  </div>
  <div class="grid-3col">
    {{cards}}
  </div>
  <p class="body-text" style="margin-top:auto; padding-top:16px; border-top:1px solid var(--beige);">{{conclusion}}</p>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "cards", label: "カード（3つ）", type: "list", maxChars: 60, maxItems: 3, required: true },
    { name: "conclusion", label: "結論・まとめ文", type: "text", maxChars: 60, required: false },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 430 },
};

export const threecolIconCards: SlideTemplate = {
  id: "threecol-icon-cards",
  name: "3カラム：アイコンカード",
  description: "アイコン＋見出し＋説明の3カラム。特長・メリットの提示に。",
  category: "three-column",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="message-area">
    <p class="key-message">{{key_message}}</p>
    <p class="caption">{{description}}</p>
  </div>
  <div class="grid-3col">
    {{cards}}
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 30, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "cards", label: "カード（3つ）", type: "list", maxChars: 60, maxItems: 3, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 370 },
};

export const threeColumnTemplates = [threecolNumberedCards, threecolIconCards];
