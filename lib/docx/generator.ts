/**
 * Word文書（.docx）生成ロジック。
 * docx npm パッケージを使用して A4 文書を生成する。
 * 参考品質: 游ゴシック、14pt H1、12pt H2、表を多用、改ページなし（連続）
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  TableOfContents,
  ShadingType,
} from "docx";
import type { DocumentData, DocxSection, DocxTableData } from "./types";

// docx の children は Paragraph | Table | TableOfContents を受け付ける
type DocChild = Paragraph | Table | TableOfContents;

// ── 定数（参考ファイル準拠） ──
const FONT_EN = "Yu Gothic";
const FONT_JP = "Yu Gothic";
const COLOR_NAVY = "16213E";
const COLOR_H2 = "1A1A2E";
const COLOR_TEXT = "333333";
const COLOR_LIGHT = "666666";
const COLOR_HEADER_BG = "16213E";
const COLOR_HEADER_TEXT = "FFFFFF";
const COLOR_BORDER = "D0D0D0";
const COLOR_ALT_ROW = "F7F8FA";
const CONTENT_WIDTH_DXA = 9026; // A4 width (11906) - left (1440) - right (1440) margins

/**
 * DocumentData からWord文書を生成し、Buffer を返す。
 */
export async function generateDocx(data: DocumentData): Promise<Buffer> {
  const children: DocChild[] = [];

  // ── 表紙 ──
  // 上部スペース
  children.push(new Paragraph({ spacing: { before: 3600 } }));

  // サブタイトル（日付・宛先など）があれば先に表示
  if (data.subtitle) {
    const subLines = data.subtitle.split("\n").filter((l) => l.trim());
    for (const line of subLines) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              font: { name: FONT_EN, eastAsia: FONT_JP },
              size: 22, // 11pt
              color: COLOR_LIGHT,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
        })
      );
    }
    children.push(new Paragraph({ spacing: { before: 200 } }));
  }

  // メインタイトル
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.title,
          font: { name: FONT_EN, eastAsia: FONT_JP },
          size: 48, // 24pt
          bold: true,
          color: COLOR_NAVY,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  // 改ページ（表紙後）
  children.push(new Paragraph({ pageBreakBefore: true }));

  // ── 目次 ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "目次",
          font: { name: FONT_EN, eastAsia: FONT_JP },
          size: 28, // 14pt
          bold: true,
          color: COLOR_NAVY,
        }),
      ],
      spacing: { after: 200 },
    }),
    new TableOfContents("目次", {
      hyperlink: true,
      headingStyleRange: "1-3",
    }),
    new Paragraph({ pageBreakBefore: true })
  );

  // ── セクション ──
  for (const section of data.sections) {
    buildSection(children, section);
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: { name: FONT_EN, eastAsia: FONT_JP },
            size: 21, // 10.5pt（ビジネス文書標準）
            color: COLOR_TEXT,
          },
          paragraph: {
            spacing: { line: 340, after: 100 },
          },
        },
        heading1: {
          run: {
            font: { name: FONT_EN, eastAsia: FONT_JP },
            size: 28, // 14pt
            bold: true,
            color: COLOR_NAVY,
          },
          paragraph: {
            spacing: { before: 360, after: 200 },
            outlineLevel: 0,
          },
        },
        heading2: {
          run: {
            font: { name: FONT_EN, eastAsia: FONT_JP },
            size: 24, // 12pt
            bold: true,
            color: COLOR_H2,
          },
          paragraph: {
            spacing: { before: 280, after: 160 },
            outlineLevel: 1,
          },
        },
        heading3: {
          run: {
            font: { name: FONT_EN, eastAsia: FONT_JP },
            size: 22, // 11pt
            bold: true,
            color: COLOR_TEXT,
          },
          paragraph: {
            spacing: { before: 200, after: 100 },
            outlineLevel: 2,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: {
              top: 1440, bottom: 1440,
              left: 1440, right: 1440,
            },
            pageNumbers: { start: 1 },
          },
          titlePage: true,
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: data.title,
                    font: { name: FONT_EN, eastAsia: FONT_JP },
                    size: 16, // 8pt
                    color: "AAAAAA",
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: { name: FONT_EN },
                    size: 16,
                    color: "999999",
                  }),
                  new TextRun({
                    text: " / ",
                    font: { name: FONT_EN },
                    size: 16,
                    color: "999999",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    font: { name: FONT_EN },
                    size: 16,
                    color: "999999",
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children,
      },
    ],
    numbering: {
      config: [
        {
          reference: "bullet-list",
          levels: [
            {
              level: 0,
              format: NumberFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer as Buffer;
}

// ── セクション構築（章見出し=改ページ、節・項=連続表示） ──
function buildSection(children: DocChild[], section: DocxSection): void {
  const headingMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  };

  // タイトルが空のセクション（表紙の残り情報等）は見出しなし
  if (section.title) {
    children.push(
      new Paragraph({
        text: section.title,
        heading: headingMap[section.level],
        ...(section.level === 1 ? { pageBreakBefore: true } : {}),
      })
    );
  }

  // 本文
  if (section.body) {
    if (typeof section.body === "string") {
      // 通常段落
      const paragraphs = section.body.split("\n").filter((l) => l.trim());
      for (const para of paragraphs) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: para,
                font: { name: FONT_EN, eastAsia: FONT_JP },
                size: 21,
                color: COLOR_TEXT,
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }
    } else {
      // 箇条書き（ListParagraph スタイル）
      for (const item of section.body) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: item,
                font: { name: FONT_EN, eastAsia: FONT_JP },
                size: 21,
                color: COLOR_TEXT,
              }),
            ],
            numbering: { reference: "bullet-list", level: 0 },
            spacing: { after: 40 },
          })
        );
      }
    }
  }

  // 箇条書き（本文とは別枠の要点リスト）
  if (section.bullets && section.bullets.length > 0) {
    children.push(new Paragraph({ spacing: { before: 120 } }));
    for (const item of section.bullets) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: item,
              font: { name: FONT_EN, eastAsia: FONT_JP },
              size: 21,
              color: COLOR_TEXT,
            }),
          ],
          numbering: { reference: "bullet-list", level: 0 },
          spacing: { after: 40 },
        })
      );
    }
  }

  // 表
  if (section.table) {
    children.push(new Paragraph({ spacing: { before: 80 } }));
    children.push(buildTable(section.table));
    children.push(new Paragraph({ spacing: { after: 100 } }));
  }

  // 子セクション
  if (section.children) {
    for (const child of section.children) {
      buildSection(children, child);
    }
  }
}

// ── 表の構築（偶数行に背景色、洗練されたスタイル） ──
function buildTable(data: DocxTableData): Table {
  const colCount = data.headers.length;
  const colWidth = Math.floor(CONTENT_WIDTH_DXA / colCount);
  const columnWidths = Array(colCount).fill(colWidth) as number[];
  // 最終カラムで端数を吸収
  columnWidths[colCount - 1] = CONTENT_WIDTH_DXA - colWidth * (colCount - 1);

  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: COLOR_BORDER,
  };
  const borders = {
    top: borderStyle,
    bottom: borderStyle,
    left: borderStyle,
    right: borderStyle,
  };

  // ヘッダー行
  const headerRow = new TableRow({
    tableHeader: true,
    children: data.headers.map(
      (h, i) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: h,
                  font: { name: FONT_EN, eastAsia: FONT_JP },
                  size: 20, // 10pt
                  bold: true,
                  color: COLOR_HEADER_TEXT,
                }),
              ],
            }),
          ],
          width: { size: columnWidths[i], type: WidthType.DXA },
          shading: {
            fill: COLOR_HEADER_BG,
            type: ShadingType.CLEAR,
            color: "auto",
          },
          borders,
          margins: {
            top: 40, bottom: 40, left: 80, right: 80,
          },
        })
    ),
  });

  // データ行（偶数行に薄い背景色）
  const dataRows = data.rows.map(
    (row, rowIdx) =>
      new TableRow({
        children: row.map(
          (cell, colIdx) =>
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cell,
                      font: { name: FONT_EN, eastAsia: FONT_JP },
                      size: 20,
                      color: COLOR_TEXT,
                    }),
                  ],
                }),
              ],
              width: { size: columnWidths[colIdx], type: WidthType.DXA },
              shading: rowIdx % 2 === 1
                ? { fill: COLOR_ALT_ROW, type: ShadingType.CLEAR, color: "auto" }
                : undefined,
              borders,
              margins: {
                top: 40, bottom: 40, left: 80, right: 80,
              },
            })
        ),
      })
  );

  return new Table({
    width: { size: CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths,
    rows: [headerRow, ...dataRows],
  });
}
