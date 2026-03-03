import type {
  DiscussionMode,
  BriefSheetTone,
  CoverageItemKey,
} from "./types";

export interface DiscussionModeConfig {
  key: DiscussionMode;
  label: string;
  description: string;
  color: string;
}

export const DISCUSSION_MODES: DiscussionModeConfig[] = [
  {
    key: "draw_out",
    label: "引き出し",
    description: "質問で考えの核を掘り起こす",
    color: "bg-blue-500",
  },
  {
    key: "challenge",
    label: "壁打ち",
    description: "アイデアの強み・弱みを率直に評価",
    color: "bg-amber-500",
  },
  {
    key: "expand",
    label: "膨らませ",
    description: "具体例や事例で方向性を広げる",
    color: "bg-emerald-500",
  },
  {
    key: "structure",
    label: "まとめ",
    description: "提案の流れを構成する",
    color: "bg-purple-500",
  },
];

export interface CoverageItemConfig {
  key: CoverageItemKey;
  label: string;
}

export const COVERAGE_ITEMS: CoverageItemConfig[] = [
  { key: "client_info", label: "クライアント" },
  { key: "background", label: "課題・背景" },
  { key: "hypothesis", label: "仮説・アイデア" },
  { key: "goal", label: "ゴール" },
  { key: "constraints", label: "制約条件" },
];

export interface ToneConfig {
  key: BriefSheetTone;
  label: string;
  description: string;
}

export const BRIEF_SHEET_TONES: ToneConfig[] = [
  {
    key: "logical",
    label: "論理型",
    description: "根拠→課題→解決策→効果の積み上げ",
  },
  {
    key: "emotional",
    label: "感情型",
    description: "ストーリー→共感→ビジョン→行動の流れ",
  },
  {
    key: "hybrid",
    label: "ハイブリッド",
    description: "論理の骨格にストーリーを載せる",
  },
];
