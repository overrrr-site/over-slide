import type { ProjectTypeConfig, NoteItem } from "./types";

// ============================================================
// 人月単価・消費税
// ============================================================

export const ASSIGNEE_RATES = {
  director: { monthlyRate: 3_000_000, dailyRate: 150_000, label: "ディレクター" },
  sales: { monthlyRate: 2_000_000, dailyRate: 100_000, label: "営業" },
} as const;

export const TAX_RATE = 0.1;
export const WORKING_DAYS_PER_MONTH = 20;

// ============================================================
// 見積ステータス
// ============================================================

export const QUOTE_STATUSES = {
  draft: { label: "下書き", color: "bg-status-draft-bg text-status-draft-text" },
  submitted: { label: "提出済み", color: "bg-status-active-bg text-status-active-text" },
  won: { label: "受注", color: "bg-status-success-bg text-status-success-text" },
  lost: { label: "失注", color: "bg-status-error-bg text-status-error-text" },
} as const;

// ============================================================
// 担当営業（固定2名）
// ============================================================

export const SALES_MEMBERS = [
  { id: "member_1", name: "担当者1" },
  { id: "member_2", name: "担当者2" },
] as const;

// ============================================================
// 案件タイプ（12種）
// ============================================================

export const PROJECT_TYPES: ProjectTypeConfig[] = [
  { id: "web", label: "Webサイト制作" },
  { id: "video", label: "動画制作" },
  { id: "graphic", label: "グラフィック制作" },
  { id: "print", label: "印刷物制作" },
  { id: "content", label: "記事・コンテンツ制作" },
  { id: "casting", label: "キャスティング" },
  { id: "event", label: "イベント企画・実施" },
  { id: "advertising", label: "広告代理" },
  { id: "consulting", label: "コンサルテーション" },
  { id: "research", label: "調査企画・実施" },
  { id: "other", label: "その他" },
];

// ============================================================
// 備考・免責事項テンプレート
// ============================================================

type NoteTemplateConfig = {
  id: string;
  label: string;
  defaultText: string;
  /** この備考が自動ONになる案件タイプ ID。"all" は全タイプ共通 */
  applicableTypes: string[];
};

export const NOTE_TEMPLATES: NoteTemplateConfig[] = [
  // ============================================================
  // グループ1: 全タイプ共通（11個）
  // ============================================================
  {
    id: "payment_terms",
    label: "支払条件",
    defaultText: "お支払い条件は月末締め翌月末払いとさせていただきます。",
    applicableTypes: ["all"],
  },
  {
    id: "validity_period",
    label: "有効期限",
    defaultText: "本お見積書の有効期限は発行日より30日間とさせていただきます。",
    applicableTypes: ["all"],
  },
  {
    id: "scope_change",
    label: "要件変更時の再見積",
    defaultText: "ご要件の変更・追加が生じた場合は、別途お見積りをさせていただきます。",
    applicableTypes: ["all"],
  },
  {
    id: "schedule_change",
    label: "納期変動",
    defaultText: "素材のご提供・ご確認・ご承認の遅れにより、納期が変動する場合がございます。",
    applicableTypes: ["all"],
  },
  {
    id: "force_majeure",
    label: "不可抗力免責",
    defaultText: "天災・大規模障害等の不可抗力による納期遅延については免責とさせていただきます。",
    applicableTypes: ["all"],
  },
  {
    id: "tax_included",
    label: "消費税",
    defaultText: "上記金額には消費税（10%）が含まれております。税率変更時は変更後の税率を適用いたします。",
    applicableTypes: ["all"],
  },
  {
    id: "partial_payment",
    label: "分割払い",
    defaultText: "金額が大きい場合、着手時・中間・納品時の分割でのお支払いをお願いする場合がございます。",
    applicableTypes: ["all"],
  },
  {
    id: "cancellation_fee",
    label: "キャンセル料",
    defaultText: "着手後のキャンセルにつきましては、進行度合いに応じた費用をご請求させていただきます。",
    applicableTypes: ["all"],
  },
  {
    id: "confidentiality",
    label: "秘密保持",
    defaultText: "本お見積書の内容は秘密情報として取り扱い、第三者への開示はご遠慮ください。",
    applicableTypes: ["all"],
  },
  {
    id: "rush_fee",
    label: "特急対応",
    defaultText: "通常スケジュールより短縮が必要な場合、特急料金として別途費用が発生する場合がございます。",
    applicableTypes: ["all"],
  },
  {
    id: "client_material",
    label: "素材提供のお願い",
    defaultText: "必要な素材（テキスト・画像・ロゴデータ等）は、お客様にてご用意をお願いいたします。",
    applicableTypes: ["all"],
  },

  // ============================================================
  // グループ2: 制作系共通（6個）
  // ============================================================
  {
    id: "revision_limit",
    label: "修正回数制限",
    defaultText: "修正は各工程につき2回まで含まれております。3回目以降は別途費用となります。",
    applicableTypes: ["web", "video", "graphic", "print", "content"],
  },
  {
    id: "copyright",
    label: "著作権の帰属",
    defaultText: "納品物の著作権の帰属については、別途締結する契約書に基づき取り扱います。",
    applicableTypes: ["web", "video", "graphic", "print", "content", "casting"],
  },
  {
    id: "stock_material",
    label: "素材ライセンス費",
    defaultText: "有料ストック素材（写真・イラスト・フォント等）を使用する場合、ライセンス費用は別途ご負担いただきます。",
    applicableTypes: ["web", "video", "graphic", "print", "content"],
  },
  {
    id: "approval_responsibility",
    label: "校正・確認責任",
    defaultText: "最終成果物のテキスト内容・数値等の正確性については、お客様による校正・ご確認をお願いいたします。",
    applicableTypes: ["web", "video", "graphic", "print", "content"],
  },
  {
    id: "delivery_format",
    label: "納品形式",
    defaultText: "納品データの形式は事前にお打ち合わせのうえ決定いたします。形式変更は追加費用が発生する場合がございます。",
    applicableTypes: ["web", "video", "graphic", "print", "content"],
  },
  {
    id: "source_data",
    label: "元データ提供",
    defaultText: "デザインの元データ（編集可能なファイル）の提供は本見積に含まれておりません。ご希望の場合は別途ご相談ください。",
    applicableTypes: ["graphic", "print", "video"],
  },

  // ============================================================
  // グループ3: タイプ別
  // ============================================================

  // --- Web（5個）---
  {
    id: "external_service",
    label: "外部サービス費用除外",
    defaultText: "サーバー費用・ドメイン取得費・SSL証明書・外部API利用料等は本見積には含まれておりません。",
    applicableTypes: ["web"],
  },
  {
    id: "browser_support",
    label: "ブラウザ対応範囲",
    defaultText: "対応ブラウザはChrome / Safari / Edge の最新版といたします。旧バージョンへの対応は別途費用となります。",
    applicableTypes: ["web"],
  },
  {
    id: "cms_training",
    label: "CMS操作説明",
    defaultText: "CMS（更新システム）の操作説明は1回分を含みます。追加のレクチャーは別途費用となります。",
    applicableTypes: ["web"],
  },
  {
    id: "maintenance_excluded",
    label: "保守・運用費除外",
    defaultText: "公開後の保守・運用・更新作業は本見積には含まれておりません。別途保守契約をご検討ください。",
    applicableTypes: ["web"],
  },
  {
    id: "seo_disclaimer",
    label: "SEO効果の免責",
    defaultText: "SEO対策を施しますが、検索順位の向上を保証するものではございません。",
    applicableTypes: ["web", "content"],
  },

  // --- Video（4個）---
  {
    id: "shooting_weather",
    label: "撮影の天候リスク",
    defaultText: "屋外撮影は天候により延期となる場合がございます。延期に伴う追加費用が発生する場合がございます。",
    applicableTypes: ["video", "content"],
  },
  {
    id: "talent_usage_rights",
    label: "出演者肖像権の利用範囲",
    defaultText: "出演者の肖像利用範囲（媒体・期間・地域）は事前にお打ち合わせのうえ決定いたします。範囲外の利用には追加費用が発生いたします。",
    applicableTypes: ["video", "casting"],
  },
  {
    id: "music_license",
    label: "音楽ライセンス",
    defaultText: "BGM・効果音のライセンス費用は本見積に含まれております。お客様ご指定の楽曲を使用する場合は、別途権利処理費用が発生いたします。",
    applicableTypes: ["video"],
  },
  {
    id: "video_length",
    label: "動画尺の変更",
    defaultText: "動画の尺（長さ）の大幅な変更は追加費用が発生する場合がございます。",
    applicableTypes: ["video"],
  },

  // --- Print（2個）---
  {
    id: "print_color_variance",
    label: "印刷色差",
    defaultText: "画面上の色と印刷物の仕上がりには若干の差異が生じる場合がございます。あらかじめご了承ください。",
    applicableTypes: ["print"],
  },
  {
    id: "print_delivery",
    label: "印刷・配送費",
    defaultText: "印刷費・配送費は部数・仕様により変動いたします。最終仕様確定後に正式な金額をご案内いたします。",
    applicableTypes: ["print"],
  },

  // --- Casting（2個）---
  {
    id: "casting_availability",
    label: "キャスト変更の可能性",
    defaultText: "キャストのスケジュール・体調等の事情により、出演者が変更となる場合がございます。",
    applicableTypes: ["casting"],
  },
  {
    id: "casting_contract_scope",
    label: "キャスト契約範囲",
    defaultText: "キャストとの契約条件（出演媒体・使用期間・二次利用等）は別途個別にお取り決めいただきます。",
    applicableTypes: ["casting"],
  },

  // --- Event（4個）---
  {
    id: "travel_expense",
    label: "交通費・宿泊費・実費",
    defaultText: "交通費・宿泊費その他の実費は別途ご請求させていただきます。",
    applicableTypes: ["content", "event", "research", "casting"],
  },
  {
    id: "event_venue_cancel",
    label: "会場キャンセル費",
    defaultText: "会場のキャンセルに伴うキャンセル料はお客様のご負担となります。",
    applicableTypes: ["event"],
  },
  {
    id: "event_attendees",
    label: "参加者数の変動",
    defaultText: "参加人数の大幅な変動により、追加の備品・スタッフ費用が発生する場合がございます。",
    applicableTypes: ["event"],
  },
  {
    id: "event_permits",
    label: "許認可・届出",
    defaultText: "イベント実施に必要な許認可・届出の取得手続きはお客様にてお願いいたします。弊社によるサポートが必要な場合は別途ご相談ください。",
    applicableTypes: ["event"],
  },

  // --- Advertising（4個）---
  {
    id: "ad_performance",
    label: "広告効果の免責",
    defaultText: "広告のクリック数・コンバージョン数等の成果を保証するものではございません。",
    applicableTypes: ["advertising"],
  },
  {
    id: "ad_platform_change",
    label: "媒体仕様変更",
    defaultText: "広告媒体側の仕様変更・審査基準の変更等により、追加の対応費用が発生する場合がございます。",
    applicableTypes: ["advertising"],
  },
  {
    id: "ad_budget_separate",
    label: "広告出稿費別途",
    defaultText: "広告媒体への出稿費（広告予算）は本見積には含まれておりません。別途ご用意をお願いいたします。",
    applicableTypes: ["advertising"],
  },
  {
    id: "ad_compliance",
    label: "広告表現の法令遵守",
    defaultText: "広告表現は関連法令（景品表示法・薬機法等）に準拠いたしますが、最終的な法令適合性の確認はお客様にてお願いいたします。",
    applicableTypes: ["advertising", "content"],
  },

  // --- Consulting（2個）---
  {
    id: "consulting_outcome",
    label: "コンサル成果の免責",
    defaultText: "コンサルティングの内容に基づく施策の効果・成果を保証するものではございません。",
    applicableTypes: ["consulting"],
  },
  {
    id: "consulting_scope",
    label: "助言範囲の明確化",
    defaultText: "ご提供するのは助言・提案であり、実行・実装作業は本見積には含まれておりません。",
    applicableTypes: ["consulting"],
  },

  // --- Research（3個）---
  {
    id: "research_objectivity",
    label: "調査結果の客観性",
    defaultText: "調査結果は収集データに基づく分析であり、特定の結論を保証するものではございません。",
    applicableTypes: ["research"],
  },
  {
    id: "research_sample_size",
    label: "調査対象の変動",
    defaultText: "調査対象者の確保状況により、サンプル数やスケジュールが変動する場合がございます。",
    applicableTypes: ["research"],
  },
  {
    id: "research_privacy",
    label: "個人情報の取り扱い",
    defaultText: "調査で取得する個人情報は、個人情報保護法に基づき適切に管理いたします。",
    applicableTypes: ["research"],
  },
];

/**
 * 選択した案件タイプに応じて、適用すべき備考テンプレートを生成する
 */
export function generateNotesForTypes(selectedTypes: string[]): NoteItem[] {
  return NOTE_TEMPLATES.map((tmpl) => {
    const isApplicable =
      tmpl.applicableTypes.includes("all") ||
      tmpl.applicableTypes.some((t) => selectedTypes.includes(t));
    return {
      id: tmpl.id,
      label: tmpl.label,
      text: tmpl.defaultText,
      enabled: isApplicable,
    };
  });
}

// ============================================================
// 備考のグループ化（案件タイプ別）
// ============================================================

export type NoteGroup = {
  groupId: string;
  groupLabel: string;
  notes: NoteItem[];
};

/**
 * 備考を「共通事項」と「案件タイプごと」にグループ化する。
 * 複数タイプに該当する備考は、最初に該当するグループにだけ表示（重複防止）。
 */
export function groupNotesByType(
  notes: NoteItem[],
  selectedTypes: string[]
): NoteGroup[] {
  const groups: NoteGroup[] = [];
  const assignedIds = new Set<string>();

  // 共通事項（applicableTypes: ["all"]）
  const commonNotes = notes.filter((n) => {
    const tmpl = NOTE_TEMPLATES.find((t) => t.id === n.id);
    return tmpl?.applicableTypes.includes("all");
  });
  if (commonNotes.length > 0) {
    groups.push({ groupId: "common", groupLabel: "共通事項", notes: commonNotes });
    commonNotes.forEach((n) => assignedIds.add(n.id));
  }

  // 選択中の各タイプごと
  for (const typeId of selectedTypes) {
    const pt = PROJECT_TYPES.find((p) => p.id === typeId);
    if (!pt) continue;
    const typeNotes = notes.filter((n) => {
      if (assignedIds.has(n.id)) return false;
      const tmpl = NOTE_TEMPLATES.find((t) => t.id === n.id);
      return tmpl?.applicableTypes.includes(typeId) ?? false;
    });
    if (typeNotes.length > 0) {
      groups.push({ groupId: typeId, groupLabel: pt.label, notes: typeNotes });
      typeNotes.forEach((n) => assignedIds.add(n.id));
    }
  }

  return groups;
}

// ============================================================
// 発行者情報（PDF出力用固定値）
// ============================================================

export const COMPANY_INFO = {
  name: "OVER株式会社",
  zipCode: "〒150-0000",
  address: "東京都渋谷区",
  tel: "03-0000-0000",
} as const;

// ============================================================
// 単位の選択肢
// ============================================================

export const UNIT_OPTIONS = [
  "式",
  "ページ",
  "本",
  "点",
  "人",
  "日",
  "月",
  "回",
  "時間",
  "部",
  "セット",
] as const;
