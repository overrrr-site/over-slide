import type { SlideTemplate } from "../template-types";

/* ─── Closing Templates ─── */

export const closingNextSteps: SlideTemplate = {
  id: "closing-next-steps",
  name: "クロージング：ネクストステップ",
  description: "番号付きリストでアクションプランを表示。",
  category: "closing",
  html: `<div class="slide">
  <div class="title-bar title-bar--green">
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
    { name: "title", label: "タイトル", type: "text", maxChars: 25, required: true },
    { name: "key_message", label: "キーメッセージ", type: "text", maxChars: 60, required: false },
    { name: "description", label: "補足説明", type: "text", maxChars: 100, required: false },
    { name: "steps", label: "ステップ", type: "list", maxChars: 50, maxItems: 5, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 435 },
};

export const closingSummary: SlideTemplate = {
  id: "closing-summary",
  name: "クロージング：まとめ",
  description: "要点をボックスで強調しながら箇条書き。",
  category: "closing",
  html: `<div class="slide">
  <div class="title-bar title-bar--green">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="content-area" style="gap:16px; display:flex; flex-direction:column;">
    <div class="info-box info-box--navy">
      <p class="body-text"><strong>{{highlight}}</strong></p>
    </div>
    <ul class="bullet-list">
      {{bullets}}
    </ul>
    <p class="caption" style="margin-top:auto;">{{closing_note}}</p>
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 25, required: true },
    { name: "highlight", label: "強調メッセージ", type: "text", maxChars: 60, required: true },
    { name: "bullets", label: "要点", type: "list", maxChars: 40, maxItems: 4, required: true },
    { name: "closing_note", label: "締めの一文", type: "text", maxChars: 40, required: false },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 245 },
};

export const closingThankYou: SlideTemplate = {
  id: "closing-thank-you",
  name: "クロージング：Thank You",
  description: "ロゴを中央に表示するラストスライド。",
  category: "closing",
  html: `<div class="slide slide--navy flex-col-center" style="text-align:center;">
  <img src="/logo2.png" alt="" style="height:192px; width:auto;" />
</div>`,
  slots: [],
  constraints: { maxTotalChars: 0 },
};

export const closingTemplates = [closingNextSteps, closingSummary, closingThankYou];
