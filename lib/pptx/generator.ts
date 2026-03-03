import PptxGenJS from "pptxgenjs";
import { defineTemplate, DEFAULT_COLORS, type ColorScheme } from "./template";
import { FONTS, TYPOGRAPHY } from "@/lib/utils/constants";
import type {
  SlideData,
  PresentationData,
  BulletItem,
  TableData,
  ChartData,
} from "./types";

export async function generatePptx(data: PresentationData): Promise<Buffer> {
  const pptx = new PptxGenJS();
  const colors: ColorScheme = data.colorScheme || DEFAULT_COLORS;

  defineTemplate(pptx, colors);
  pptx.title = data.title;

  for (const slideData of data.slides) {
    const slide = pptx.addSlide({ masterName: slideData.masterName });

    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }

    switch (slideData.masterName) {
      case "COVER":
        addCoverContent(slide, slideData, colors);
        break;
      case "SECTION":
        addSectionContent(slide, slideData, colors);
        break;
      case "CONTENT_1COL":
        addContent1Col(slide, slideData, colors);
        break;
      case "CONTENT_2COL":
        addContent2Col(slide, slideData, colors);
        break;
      case "CONTENT_VISUAL":
        addContentVisual(slide, slideData, colors);
        break;
      case "DATA_HIGHLIGHT":
        addDataHighlight(slide, slideData, colors);
        break;
      case "CLOSING":
        addClosingContent(slide, slideData, colors);
        break;
    }
  }

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}

// ── Cover ──
function addCoverContent(
  slide: PptxGenJS.Slide,
  data: SlideData,
  colors: ColorScheme
) {
  // Fill title placeholder
  if (data.title) {
    slide.addText(data.title, {
      placeholder: "title",
    });
  }
  // Fill subtitle placeholder
  if (data.subtitle) {
    slide.addText(data.subtitle, {
      placeholder: "subtitle",
    });
  }
  void colors;
}

// ── Section ──
function addSectionContent(
  slide: PptxGenJS.Slide,
  data: SlideData,
  colors: ColorScheme
) {
  // Fill section title placeholder
  if (data.title) {
    slide.addText(data.title, {
      placeholder: "sectionTitle",
    });
  }
  // Fill section description placeholder
  if (typeof data.body === "string" && data.body) {
    slide.addText(data.body, {
      placeholder: "sectionDesc",
    });
  }
  void colors;
}

// ── Content 1 Column ──
function addContent1Col(
  slide: PptxGenJS.Slide,
  data: SlideData,
  colors: ColorScheme
) {
  if (data.body) {
    // If there's also a table or chart, give body less height
    const bodyH = data.table || data.chart ? 2.5 : 5.0;
    addBodyContent(slide, data.body, colors, {
      x: 0.8,
      y: 1.5,
      w: 11.5,
      h: bodyH,
    });
  }
  if (data.kpiCards?.length) {
    // Render KPI cards even in CONTENT_1COL layout
    addKpiCards(slide, data, colors);
  }
  if (data.table) {
    const tableY = data.body ? 4.2 : 1.8;
    addTable(slide, data.table, colors, tableY);
  }
  if (data.chart) {
    const chartY = data.body ? 4.0 : 1.5;
    addChart(slide, data.chart, colors, { x: 1.5, y: chartY, w: 10.0, h: 3.5 });
  }
  if (data.image) {
    slide.addImage({
      data: `image/${data.image.type};base64,${data.image.data}`,
      x: 1.0,
      y: 1.5,
      w: data.image.w,
      h: data.image.h,
    });
  }
  if (data.infographic) {
    slide.addImage({
      data: `image/svg+xml;base64,${Buffer.from(data.infographic).toString("base64")}`,
      x: 1.0,
      y: 1.5,
      w: 10.0,
      h: 5.0,
    });
  }
}

// ── Content 2 Columns ──
function addContent2Col(
  slide: PptxGenJS.Slide,
  data: SlideData,
  colors: ColorScheme
) {
  if (data.bodyLeft) {
    addBodyContent(slide, data.bodyLeft, colors, {
      x: 0.8,
      y: 1.5,
      w: 5.4,
      h: 5.0,
    });
  }
  if (data.bodyRight) {
    addBodyContent(slide, data.bodyRight, colors, {
      x: 6.8,
      y: 1.5,
      w: 5.4,
      h: 5.0,
    });
  }
}

// ── Content Visual ──
function addContentVisual(
  slide: PptxGenJS.Slide,
  data: SlideData,
  colors: ColorScheme
) {
  if (data.image) {
    slide.addImage({
      data: `image/${data.image.type};base64,${data.image.data}`,
      x: 0.8,
      y: 1.5,
      w: data.image.w,
      h: data.image.h,
    });
  }
  if (data.chart) {
    addChart(slide, data.chart, colors, { x: 0.8, y: 1.5, w: 11.5, h: 5.5 });
  }
  if (data.infographic) {
    slide.addImage({
      data: `image/svg+xml;base64,${Buffer.from(data.infographic).toString("base64")}`,
      x: 0.5,
      y: 1.5,
      w: 12.0,
      h: 5.5,
    });
  }
}

// ── KPI Cards (shared by DATA_HIGHLIGHT and CONTENT_1COL) ──
function addKpiCards(
  slide: PptxGenJS.Slide,
  data: SlideData,
  colors: ColorScheme
) {
  if (!data.kpiCards?.length) return;

  const cardCount = data.kpiCards.length;
  const cardW = Math.min(3.0, 11.5 / cardCount - 0.3);
  const gap = (11.5 - cardW * cardCount) / (cardCount + 1);

  data.kpiCards.forEach((kpi, i) => {
    const x = 0.8 + gap + i * (cardW + gap);
    const accentColor =
      kpi.accentColor === "green" ? colors.green : colors.navy;

    // Card background
    slide.addShape("rect" as PptxGenJS.ShapeType, {
      x,
      y: 2.0,
      w: cardW,
      h: 3.0,
      fill: { color: colors.beige },
      line: { color: accentColor, width: 2 },
      rectRadius: 0.1,
    });

    // Value
    slide.addText(kpi.value, {
      x,
      y: 2.3,
      w: cardW,
      h: 1.5,
      fontSize: TYPOGRAPHY.kpiValue.size,
      fontFace: TYPOGRAPHY.kpiValue.font,
      color: accentColor,
      bold: true,
      align: "center",
      valign: "middle",
    });

    // Unit
    if (kpi.unit) {
      slide.addText(kpi.unit, {
        x,
        y: 3.5,
        w: cardW,
        h: 0.5,
        fontSize: 14,
        fontFace: FONTS.jp,
        color: colors.textSecondary,
        align: "center",
      });
    }

    // Label
    slide.addText(kpi.label, {
      x,
      y: 4.0,
      w: cardW,
      h: 0.8,
      fontSize: TYPOGRAPHY.kpiLabel.size,
      fontFace: TYPOGRAPHY.kpiLabel.font,
      color: colors.textPrimary,
      align: "center",
      valign: "top",
    });
  });
}

// ── Data Highlight (KPI Cards) ──
function addDataHighlight(
  slide: PptxGenJS.Slide,
  data: SlideData,
  colors: ColorScheme
) {
  addKpiCards(slide, data, colors);
}

// ── Closing ──
function addClosingContent(
  slide: PptxGenJS.Slide,
  data: SlideData,
  colors: ColorScheme
) {
  if (!Array.isArray(data.body)) return;

  const textItems = (data.body as BulletItem[]).map((item, i) => {
    const text = typeof item === "string" ? item : item.text;
    return {
      text: `${i + 1}. ${text}`,
      options: {
        fontSize: 16,
        fontFace: FONTS.jp,
        breakLine: true,
        lineSpacing: 28,
        color: colors.textPrimary,
      },
    };
  });
  slide.addText(textItems as PptxGenJS.TextProps[], {
    x: 0.8,
    y: 1.8,
    w: 11.5,
    h: 4.5,
    valign: "top",
  });
}

// ── Helpers ──

function addBodyContent(
  slide: PptxGenJS.Slide,
  body: string | BulletItem[],
  colors: ColorScheme,
  pos: { x: number; y: number; w: number; h: number }
) {
  if (typeof body === "string") {
    slide.addText(body, {
      ...pos,
      fontSize: TYPOGRAPHY.bodyText.size,
      fontFace: TYPOGRAPHY.bodyText.font,
      color: colors.textPrimary,
      valign: "top",
    });
    return;
  }

  const textItems = body.map((item) => {
    const text = typeof item === "string" ? item : item.text;
    return {
      text,
      options: {
        bullet: { code: "2022" as const },
        fontSize: TYPOGRAPHY.bodyText.size,
        fontFace: TYPOGRAPHY.bodyText.font,
        breakLine: true,
        color: colors.textPrimary,
      },
    };
  });

  slide.addText(textItems as PptxGenJS.TextProps[], {
    ...pos,
    valign: "top",
  });
}

function addTable(
  slide: PptxGenJS.Slide,
  table: TableData,
  colors: ColorScheme,
  startY = 1.8
) {
  const headerRow = table.headers.map((h) => ({
    text: h,
    options: {
      bold: true,
      fontSize: TYPOGRAPHY.tableHeader.size,
      fontFace: TYPOGRAPHY.tableHeader.font,
      fill: { color: colors.navy },
      color: colors.white,
      border: {
        type: "solid" as const,
        pt: 0.5,
        color: colors.textSecondary,
      },
      margin: [5, 8, 5, 8] as [number, number, number, number],
    },
  }));

  const dataRows = table.rows.map((row) =>
    row.map((cell) => ({
      text: cell,
      options: {
        fontSize: TYPOGRAPHY.tableBody.size,
        fontFace: TYPOGRAPHY.tableBody.font,
        color: colors.textPrimary,
        border: {
          type: "solid" as const,
          pt: 0.5,
          color: colors.beige,
        },
        margin: [4, 8, 4, 8] as [number, number, number, number],
      },
    }))
  );

  slide.addTable(
    [headerRow, ...dataRows] as PptxGenJS.TableRow[],
    {
      x: 0.8,
      y: startY,
      w: 11.5,
      colW: table.headers.map(() => 11.5 / table.headers.length),
      autoPage: true,
    }
  );
}

function addChart(
  slide: PptxGenJS.Slide,
  chart: ChartData,
  colors: ColorScheme,
  position = { x: 1.5, y: 2.0, w: 10.0, h: 4.5 }
) {
  const chartColors = [
    colors.navy,
    colors.green,
    "EA4335",
    "FBBC04",
    "9334E6",
    "FF6D01",
  ];

  const chartTypeMap: Record<string, PptxGenJS.CHART_NAME> = {
    bar: pptxChartType("bar"),
    line: pptxChartType("line"),
    pie: pptxChartType("pie"),
    doughnut: pptxChartType("doughnut"),
    area: pptxChartType("area"),
    radar: pptxChartType("radar"),
  };

  slide.addChart(chartTypeMap[chart.type], chart.data, {
    ...position,
    showTitle: false,
    showValue: chart.type === "pie" || chart.type === "doughnut",
    showLegend: true,
    legendPos: "b",
    chartColors,
    ...chart.options,
  });
}

function pptxChartType(type: string): PptxGenJS.CHART_NAME {
  return type.toUpperCase() as unknown as PptxGenJS.CHART_NAME;
}
