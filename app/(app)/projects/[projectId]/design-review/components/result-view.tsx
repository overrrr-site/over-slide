"use client";

import type { ResultViewProps } from "../types";

function SlidePreview({
  title,
  borderClassName,
  doc,
}: {
  title: string;
  borderClassName: string;
  doc: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold">{title}</p>
      <div className={`overflow-hidden rounded-lg bg-gray-50 ${borderClassName}`}>
        <div className="relative aspect-[16/9]">
          <iframe
            srcDoc={doc}
            title={title}
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
                  const scale = parent.clientWidth / 960;
                  el.style.transform = `scale(${scale})`;
                  el.style.transformOrigin = "top left";
                  parent.style.height = `${540 * scale}px`;
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function ResultView({
  appliedItems,
  beforeSlides,
  afterSlides,
  compareIndex,
  setCompareIndex,
  downloadUrl,
  downloadingPdf,
  onBackToReview,
  onReRunReview,
  onBackToDesign,
  onDownloadPdf,
  onComplete,
  buildPreviewDoc,
}: ResultViewProps) {
  const currentBefore = beforeSlides[compareIndex];
  const currentAfter = afterSlides[compareIndex];

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy">デザイン反映結果</h2>
            <p className="text-xs text-text-secondary">
              {appliedItems.length}件の指摘を反映しました
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onBackToReview}
              className="rounded-md border border-beige bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-off-white"
            >
              レビューに戻る
            </button>
            <button
              onClick={onReRunReview}
              className="rounded-md border border-navy bg-white px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
            >
              再レビュー
            </button>
            <button
              onClick={onBackToDesign}
              className="rounded-md border border-beige bg-white px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-off-white"
            >
              デザインに戻る
            </button>
            <button
              onClick={onDownloadPdf}
              disabled={downloadingPdf}
              className="rounded-md border border-navy bg-white px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-navy/5 disabled:opacity-50"
            >
              {downloadingPdf ? "PDF変換中..." : "PDFをダウンロード"}
            </button>
            <button
              onClick={onComplete}
              className="rounded-md bg-green px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green/90"
            >
              デザイン完了
            </button>
          </div>
        </div>

        {downloadUrl && !downloadingPdf && (
          <div className="mb-4 rounded-md border border-green bg-green/5 p-3">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-green hover:underline"
            >
              📄 PDFをダウンロード
            </a>
          </div>
        )}

        <div className="mb-6 rounded-lg border border-green bg-green/5 p-4">
          <h3 className="mb-2 text-sm font-bold text-green">採用した指摘</h3>
          <ul className="space-y-1">
            {appliedItems.map((item, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-text-primary"
              >
                <span className="text-green">&#10003;</span>
                <span>
                  {item.target_page && (
                    <span className="mr-1 rounded bg-navy/10 px-1 py-0.5 text-navy">
                      S{item.target_page}
                    </span>
                  )}
                  {item.description}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-text-secondary">スライド:</span>
          {afterSlides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCompareIndex(idx)}
              className={`flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors ${
                compareIndex === idx
                  ? "bg-navy text-white"
                  : "bg-beige/50 text-text-secondary hover:bg-beige"
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <SlidePreview
              title="変更前"
              borderClassName="border border-beige"
              doc={buildPreviewDoc(currentBefore)}
            />
            <p className="mt-1 text-xs text-text-secondary">
              {currentBefore?.title}
            </p>
          </div>
          <div>
            <SlidePreview
              title="変更後"
              borderClassName="border border-green/30"
              doc={buildPreviewDoc(currentAfter)}
            />
            <p className="mt-1 text-xs text-text-secondary">
              {currentAfter?.title}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
