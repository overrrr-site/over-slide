import type { SlideTemplate } from "../template-types";

/* ─── Table of Contents Templates ─── */

export const tocNumbered: SlideTemplate = {
  id: "toc-numbered",
  name: "目次：番号付き",
  description: "セクション番号＋タイトル＋ページ番号を点線で接続。提案書の定番。",
  category: "toc",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="content-area" style="gap:0;">
    {{toc_items}}
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 20, required: true },
    { name: "toc_items", label: "目次項目", type: "list", maxChars: 30, maxItems: 8, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 260 },
};

export const tocSimple: SlideTemplate = {
  id: "toc-simple",
  name: "目次：シンプル",
  description: "番号＋セクション名のみのシンプルな目次。",
  category: "toc",
  html: `<div class="slide">
  <div class="title-bar">
    <h2 class="slide-title">{{title}}</h2>
  </div>
  <div class="content-area" style="gap:0;">
    {{toc_items}}
  </div>
  <span class="slide-number">{{page_number}}</span>
</div>`,
  slots: [
    { name: "title", label: "タイトル", type: "text", maxChars: 20, required: true },
    { name: "toc_items", label: "目次項目", type: "list", maxChars: 25, maxItems: 6, required: true },
    { name: "page_number", label: "ページ番号", type: "text", maxChars: 3, required: false },
  ],
  constraints: { maxTotalChars: 170 },
};

export const tocTemplates = [tocNumbered, tocSimple];
