import type { MasterSlideName } from "@/lib/utils/constants";

export interface BulletItem {
  text: string;
  icon?: string; // Iconify name, e.g., "mdi:chart-line"
  iconSvgBase64?: string; // Resolved at generation time
  subItems?: string[];
}

export interface KpiCard {
  label: string;
  value: string;
  unit?: string;
  icon?: string;
  accentColor?: "navy" | "green";
}

export interface ImageData {
  data: string; // base64
  type: "png" | "svg";
  w: number;
  h: number;
}

export interface ChartData {
  type: "bar" | "line" | "pie" | "doughnut" | "area" | "radar";
  data: Array<{ name: string; labels: string[]; values: number[] }>;
  options?: Record<string, unknown>;
}

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface SlideData {
  masterName: MasterSlideName;
  title: string;
  subtitle?: string;
  body?: string | BulletItem[];
  bodyLeft?: string | BulletItem[];
  bodyRight?: string | BulletItem[];
  image?: ImageData;
  chart?: ChartData;
  table?: TableData;
  kpiCards?: KpiCard[];
  infographic?: string; // SVG string
  notes?: string;
}

export interface PresentationData {
  title: string;
  slides: SlideData[];
  colorScheme?: {
    navy: string;
    green: string;
    beige: string;
    offWhite: string;
    textPrimary: string;
    textSecondary: string;
    white: string;
  };
}
