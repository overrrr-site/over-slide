/**
 * コンテンツ用チャンカー（モードB: content）
 * テキストを一定サイズのチャンクに分割し、chunk_type "content" として返す。
 * スタイル分析ではなく、内容ベースのRAG検索に使用される。
 */

import type { Chunk } from "./chunker";

/** チャンクの最大文字数（目安） */
const CHUNK_SIZE = 1000;
/** チャンク間のオーバーラップ文字数 */
const CHUNK_OVERLAP = 200;

/**
 * テキストをコンテンツチャンクに分割する。
 * 段落境界・句点を優先して分割し、検索精度を向上させる。
 *
 * 重要: V8 (Node.js 24) では文字列連結で作られる ConsString に対して
 * lastIndexOf / substring を呼ぶとメモリが爆発する。
 * そのため、元のテキスト文字列に対してのみ substring を実行し、
 * 中間文字列の連結を一切行わないインデックスベースのアルゴリズムを使う。
 */
export function createContentChunks(
  text: string,
  docTitle: string
): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkStart = 0;
  let chunkIndex = 0;
  const minAdvance = CHUNK_SIZE - CHUNK_OVERLAP;

  while (chunkStart < text.length) {
    let chunkEnd = Math.min(chunkStart + CHUNK_SIZE, text.length);

    // 末尾でなければ、段落境界か句点で区切る
    if (chunkEnd < text.length) {
      const paraBreak = text.lastIndexOf("\n\n", chunkEnd);
      if (paraBreak > chunkStart + CHUNK_SIZE / 2) {
        chunkEnd = paraBreak;
      } else {
        const periodIdx = text.lastIndexOf("。", chunkEnd);
        if (periodIdx > chunkStart + CHUNK_SIZE / 2) {
          chunkEnd = periodIdx + 1;
        }
      }
    }

    const content = text.substring(chunkStart, chunkEnd).trim();
    if (content) {
      chunks.push({
        chunkType: "content",
        content,
        metadata: {
          docTitle,
          section: "content",
          chunkIndex,
        },
      });
      chunkIndex++;
    }

    // オーバーラップを考慮して次の開始位置を決定
    chunkStart =
      chunkEnd > chunkStart + minAdvance
        ? chunkEnd - CHUNK_OVERLAP
        : chunkStart + minAdvance;
  }

  return chunks;
}
