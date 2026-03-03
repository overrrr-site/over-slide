import type { HtmlSlide } from "@/lib/slides/types";

export interface ReviewItem {
  type: "improvement" | "positive" | "warning";
  target_page?: number;
  description: string;
  suggestion?: string;
  priority?: "high" | "medium" | "low";
}

export interface ReviewCategory {
  name: string;
  score: number;
  items: ReviewItem[];
}

export interface ReviewData {
  overall_score: number;
  overall_comment: string;
  categories: ReviewCategory[];
}

export interface ModelReview {
  model: string;
  label: string;
  data: ReviewData | null;
  error?: string;
}

export type ItemDecision = "adopted" | "rejected" | "pending";

export interface ResultViewProps {
  appliedItems: ReviewItem[];
  beforeSlides: HtmlSlide[];
  afterSlides: HtmlSlide[];
  compareIndex: number;
  setCompareIndex: (index: number) => void;
  downloadUrl: string | null;
  downloadingPdf: boolean;
  onBackToReview: () => void;
  onReRunReview: () => void;
  onBackToDesign: () => void;
  onDownloadPdf: () => void;
  onComplete: () => void;
  buildPreviewDoc: (slide: HtmlSlide | undefined) => string;
}
