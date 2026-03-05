/**
 * Generate a preview HTML document showing all templates with sample content.
 * Run: npx tsx lib/slides/templates/preview-generator.ts
 */

import { BASE_STYLES } from "../base-styles";
import { registry } from "./index";

/* ─── Sample data for each template ─── */

const SAMPLE_DATA: Record<string, Record<string, string>> = {
  // Cover
  "cover-centered": {
    title: "DX推進による業務改革提案",
    subtitle: "株式会社サンプル様向け — 2026年3月",
  },
  "cover-left-aligned": {
    title: "次世代マーケティング\n戦略提案書",
    subtitle: "データ駆動型の顧客体験を実現する",
    date: "2026年3月 | 株式会社ABC",
  },
  "cover-bold": {
    tag: "PROPOSAL",
    title: "売上150%成長への\nロードマップ",
    subtitle: "EC事業の構造改革と新規チャネル開拓",
  },

  // Section
  "section-centered": {
    title: "現状課題の整理",
    description: "市場環境と自社の課題を分析します",
  },
  "section-numbered": {
    number: "02",
    title: "提案ソリューション",
    description: "課題を解決する3つのアプローチ",
  },
  "section-icon-accent": {
    icon: "lightbulb-outline",
    title: "施策の詳細",
    description: "具体的な実行プランと期待効果をご説明します",
  },

  // Content
  "content-bullets": {
    title: "市場分析の結果",
    key_message: "国内SaaS市場は年率18%で急成長、今が参入の好機",
    description: "市場環境・競合状況・成長余地の3つの観点から分析した結果をまとめます。",
    bullets: `<li>国内SaaS市場は年率18%で成長、2027年に1.2兆円規模</li>
      <li>中小企業のDX導入率は23%に留まり、成長余地が大きい</li>
      <li>競合3社がシェア45%を占有、差別化が急務</li>
      <li>新規参入の障壁は低下傾向にあり早期対応が必要</li>`,
    page_number: "3",
  },
  "content-bullets-icon": {
    title: "提案の3つの柱",
    key_message: "自動化・データ・人材の三位一体で変革を推進",
    description: "それぞれの施策が相互に連携し、持続的な効果を生み出します。",
    icon_bullets: `<div style="display:flex; align-items:flex-start; gap:16px;">
        <div class="icon-circle icon-circle--green" style="flex-shrink:0;">{{icon:mdi:cog}}</div>
        <div><p class="body-text"><strong>業務プロセスの自動化</strong></p><p class="caption">手作業の80%をRPAとAIで代替し、年間2,400時間を創出</p></div>
      </div>
      <div style="display:flex; align-items:flex-start; gap:16px;">
        <div class="icon-circle" style="flex-shrink:0;">{{icon:mdi:chart-line}}</div>
        <div><p class="body-text"><strong>データ基盤の構築</strong></p><p class="caption">散在するデータを統合し、リアルタイム分析を実現</p></div>
      </div>
      <div style="display:flex; align-items:flex-start; gap:16px;">
        <div class="icon-circle icon-circle--green" style="flex-shrink:0;">{{icon:mdi:account-group}}</div>
        <div><p class="body-text"><strong>組織のデジタルリテラシー向上</strong></p><p class="caption">全社員対象の研修プログラムを3ヶ月で展開</p></div>
      </div>`,
    page_number: "5",
  },
  "content-body-infobox": {
    title: "競合環境の変化",
    key_message: "差別化軸の再定義が急務 — 価格ではなく成果保証で勝つ",
    body: "過去3年間で市場参入企業が2.5倍に増加。特にクラウドネイティブなスタートアップが台頭し、従来型ソリューションのシェアを侵食しています。価格競争の激化も顕著であり、差別化軸の再定義が急務です。",
    infobox_label: "最重要ポイント:",
    infobox_text: "価格ではなく「導入後の成果保証」で差別化する戦略が有効",
    page_number: "4",
  },
  "content-table": {
    title: "施策別の投資対効果",
    key_message: "全施策でROI 140%以上を達成、業務自動化が最も高効率",
    description: "3つの施策それぞれの初期投資と期待ROIをまとめました。",
    table: `<thead><tr><th>施策</th><th>初期投資</th><th>年間効果</th><th>ROI</th></tr></thead>
      <tbody>
        <tr><td>業務自動化</td><td>¥15M</td><td>¥48M削減</td><td>320%</td></tr>
        <tr><td>データ基盤</td><td>¥25M</td><td>¥35M増収</td><td>140%</td></tr>
        <tr><td>人材育成</td><td>¥8M</td><td>¥20M効果</td><td>250%</td></tr>
      </tbody>`,
    page_number: "7",
  },
  "content-numbered-steps": {
    title: "導入プロセス",
    key_message: "9ヶ月で全社展開完了、段階的にリスクを最小化",
    description: "パイロット検証を経て本番展開する4ステップのアプローチです。",
    steps: `<li>現状業務の棚卸しとデジタル化優先度の策定（1ヶ月目）</li>
      <li>パイロット部署でのPoC実施と効果測定（2〜3ヶ月目）</li>
      <li>全社展開に向けたシステム設計と開発（4〜6ヶ月目）</li>
      <li>段階的リリースと社員トレーニング（7〜9ヶ月目）</li>`,
    page_number: "8",
  },

  // Two-column
  "twocol-comparison": {
    title: "現状 vs 導入後",
    key_message: "自動化導入で月80時間→4時間へ、95%の工数削減を実現",
    description: "主要3業務における変化を比較します。",
    left_heading: "現状の課題",
    left_bullets: `<li>手動のデータ入力で月80時間消費</li>
      <li>レポート作成に毎週2日を要する</li>
      <li>部門間のデータ不整合が頻発</li>`,
    right_heading: "導入後の姿",
    right_bullets: `<li>データ入力を95%自動化、月4時間に</li>
      <li>リアルタイムダッシュボードで即時確認</li>
      <li>統合DBで全社データの一元管理</li>`,
    page_number: "6",
  },
  "twocol-feature-grid": {
    title: "ソリューションの特長",
    key_message: "安全・高速・柔軟・万全の4つの強みでDXを支援",
    description: "エンタープライズ品質のソリューションを提供します。",
    feature_cards: `<div style="padding:20px; background:var(--white); border-radius:12px; border:1px solid var(--beige);">
        <div class="icon-circle icon-circle--green" style="margin-bottom:12px;">{{icon:mdi:shield-check}}</div>
        <p class="body-text" style="font-weight:700; margin-bottom:6px;">セキュリティ</p>
        <p class="caption">ISO27001準拠の堅牢な基盤</p>
      </div>
      <div style="padding:20px; background:var(--white); border-radius:12px; border:1px solid var(--beige);">
        <div class="icon-circle" style="margin-bottom:12px;">{{icon:mdi:rocket-launch}}</div>
        <p class="body-text" style="font-weight:700; margin-bottom:6px;">スピード</p>
        <p class="caption">最短2週間で稼働開始</p>
      </div>
      <div style="padding:20px; background:var(--white); border-radius:12px; border:1px solid var(--beige);">
        <div class="icon-circle icon-circle--green" style="margin-bottom:12px;">{{icon:mdi:trending-up}}</div>
        <p class="body-text" style="font-weight:700; margin-bottom:6px;">拡張性</p>
        <p class="caption">利用規模に応じて柔軟に拡張</p>
      </div>
      <div style="padding:20px; background:var(--white); border-radius:12px; border:1px solid var(--beige);">
        <div class="icon-circle" style="margin-bottom:12px;">{{icon:mdi:headset}}</div>
        <p class="body-text" style="font-weight:700; margin-bottom:6px;">サポート</p>
        <p class="caption">24時間365日の専任体制</p>
      </div>`,
    page_number: "9",
  },
  // Data
  "data-kpi-3": {
    title: "導入効果（初年度見込み）",
    key_message: "初年度ROI 320%、業務工数60%削減を実現",
    description: "自動化・データ活用・人材育成の3施策による複合効果です。",
    kpi_cards: `<div class="kpi-card kpi-card--navy">
        <div class="kpi-value">60%</div>
        <div class="kpi-unit">削減</div>
        <div class="kpi-label">業務工数</div>
      </div>
      <div class="kpi-card kpi-card--green">
        <div class="kpi-value">¥48M</div>
        <div class="kpi-unit">年間</div>
        <div class="kpi-label">コスト削減</div>
      </div>
      <div class="kpi-card kpi-card--navy">
        <div class="kpi-value">320%</div>
        <div class="kpi-label">投資対効果</div>
      </div>`,
    footnote: "初年度のROI 320%を見込み、2年目以降はさらに効果が拡大する想定です。",
    page_number: "11",
  },
  "data-kpi-2": {
    title: "Before / After",
    key_message: "手動作業の95%を自動化、月80時間→4時間に短縮",
    description: "自動化ツール導入によるデータ入力業務の劇的改善です。",
    kpi_cards: `<div class="kpi-card kpi-card--navy">
        <div class="kpi-value">80h</div>
        <div class="kpi-unit">月間</div>
        <div class="kpi-label">現在の作業時間</div>
      </div>
      <div class="kpi-card kpi-card--green">
        <div class="kpi-value">4h</div>
        <div class="kpi-unit">月間</div>
        <div class="kpi-label">導入後の作業時間</div>
      </div>`,
    footnote: "自動化ツールの導入により、手動作業の95%を削減。担当者は分析業務に集中可能に。",
    page_number: "12",
  },
  "data-kpi-4": {
    title: "プロジェクト概要",
    key_message: "6ヶ月・3フェーズで完了、専任15名体制で確実に推進",
    description: "段階的な導入アプローチでリスクを最小化します。",
    kpi_cards: `<div class="kpi-card kpi-card--navy">
        <div class="kpi-value">6</div>
        <div class="kpi-unit">ヶ月</div>
        <div class="kpi-label">導入期間</div>
      </div>
      <div class="kpi-card kpi-card--green">
        <div class="kpi-value">3</div>
        <div class="kpi-unit">フェーズ</div>
        <div class="kpi-label">段階導入</div>
      </div>
      <div class="kpi-card kpi-card--navy">
        <div class="kpi-value">15</div>
        <div class="kpi-unit">名</div>
        <div class="kpi-label">専任体制</div>
      </div>
      <div class="kpi-card kpi-card--green">
        <div class="kpi-value">99.9%</div>
        <div class="kpi-label">稼働保証</div>
      </div>`,
    footnote: "段階的な導入アプローチでリスクを最小化。専任チームが伴走します。",
    page_number: "13",
  },
  "data-highlight-single": {
    context: "業務自動化による年間効果",
    value: "¥48M",
    label: "コスト削減額",
    description: "手作業の80%を自動化し、年間2,400時間の工数を創出。従業員は付加価値の高い業務に集中できます。",
    page_number: "14",
  },

  // Content: Chart (consolidated from visual-bar/pie/line)
  "content-chart": {
    title: "売上推移（四半期別）",
    key_message: "Q4は前年比140%を達成、新規施策が大幅に寄与",
    description: "Q4は新規施策の効果により前年比140%を達成。",
    chart_svg: `<svg viewBox="0 0 600 280" width="600" height="280">
      <text x="30" y="30" font-size="11" fill="#666" text-anchor="end">200</text>
      <text x="30" y="100" font-size="11" fill="#666" text-anchor="end">150</text>
      <text x="30" y="170" font-size="11" fill="#666" text-anchor="end">100</text>
      <text x="30" y="240" font-size="11" fill="#666" text-anchor="end">50</text>
      <line x1="40" y1="30" x2="580" y2="30" stroke="#E8D5C4" stroke-width="0.5"/>
      <line x1="40" y1="100" x2="580" y2="100" stroke="#E8D5C4" stroke-width="0.5"/>
      <line x1="40" y1="170" x2="580" y2="170" stroke="#E8D5C4" stroke-width="0.5"/>
      <line x1="40" y1="240" x2="580" y2="240" stroke="#E8D5C4" stroke-width="0.5"/>
      <rect x="80" y="170" width="80" height="70" rx="4" fill="#1A2B4A"/>
      <rect x="200" y="100" width="80" height="140" rx="4" fill="#1A2B4A"/>
      <rect x="320" y="65" width="80" height="175" rx="4" fill="#1A2B4A"/>
      <rect x="440" y="30" width="80" height="210" rx="4" fill="#6B8E7F"/>
      <text x="120" y="265" font-size="12" fill="#2A2A2A" text-anchor="middle">Q1</text>
      <text x="240" y="265" font-size="12" fill="#2A2A2A" text-anchor="middle">Q2</text>
      <text x="360" y="265" font-size="12" fill="#2A2A2A" text-anchor="middle">Q3</text>
      <text x="480" y="265" font-size="12" fill="#2A2A2A" text-anchor="middle">Q4</text>
      <text x="120" y="165" font-size="11" fill="#1A2B4A" text-anchor="middle" font-weight="600">100</text>
      <text x="240" y="95" font-size="11" fill="#1A2B4A" text-anchor="middle" font-weight="600">150</text>
      <text x="360" y="60" font-size="11" fill="#1A2B4A" text-anchor="middle" font-weight="600">175</text>
      <text x="480" y="25" font-size="11" fill="#6B8E7F" text-anchor="middle" font-weight="600">200</text>
    </svg>`,
    page_number: "15",
  },

  // Closing
  "closing-next-steps": {
    title: "Next Steps",
    key_message: "4月から段階的に開始し、7月に本番展開を目指します",
    description: "各フェーズの完了基準を設け、確実にステップを進めます。",
    steps: `<li>プロトタイプの開発と社内テスト（4月中）</li>
      <li>パイロット導入先の選定と実施（5月上旬）</li>
      <li>効果測定レポートの提出（6月末）</li>
      <li>本番環境への段階的展開（7月〜）</li>`,
    page_number: "18",
  },
  "closing-summary": {
    title: "まとめ",
    highlight: "業務自動化×データ活用×人材育成の三位一体で、年間48Mのコスト削減と売上30%増を実現します",
    bullets: `<li>最短6ヶ月で導入完了、段階的にリスクを抑制</li>
      <li>ROI 320%の投資対効果</li>
      <li>24時間365日のサポート体制</li>`,
    closing_note: "ご不明点がございましたらお気軽にお問い合わせください",
    page_number: "19",
  },
  "closing-thank-you": {},

  // Content: Photo Background + Dark Overlay
  "content-photo-bg": {
    image: `<div class="image-placeholder" style="width:100%;height:100%;border-radius:0;min-height:auto;">都市のスカイライン</div>`,
    title: "市場の成長ポテンシャル",
    key_message: "国内DX市場は2030年に3倍規模へ拡大見込み",
    description: "今後5年間の市場予測と当社の参入戦略をまとめます。",
    bullets: `<li>市場規模は年率18%で成長中、2030年に1.2兆円規模</li>
      <li>中小企業のDX導入率はまだ23%、成長余地が大きい</li>
      <li>先行投資で競合優位性を確保し、シェア15%を目指す</li>`,
    page_number: "5",
  },
  // Two-column: Text + Fullbleed Image (right)
  "twocol-text-fullimage": {
    subtitle: "コーティングをラグジュアリーホテルの付加価値に",
    title: "コーティングスパ",
    bullets: `<li>温水・湿潤・閉鎖空間という条件が重なり、バイオフィルムが形成されやすい環境</li>
      <li>金属接触部にコーティングを適用し、衛生管理負荷を低減</li>
      <li>ホテルチェーンと共同で実証・限定客室導入へ</li>`,
    image: `<div class="image-placeholder" style="width:100%;height:100%;border-radius:0;min-height:auto;">ラグジュアリーホテルのスパ写真</div>`,
    page_number: "5",
  },
  // Two-column: Fullbleed Image (left) + Text
  "twocol-fullimage-text": {
    image: `<div class="image-placeholder" style="width:100%;height:100%;border-radius:0;min-height:auto;">最新のオフィス空間</div>`,
    subtitle: "働き方改革の最前線",
    title: "次世代オフィス",
    bullets: `<li>フレキシブルな空間設計で生産性を向上</li>
      <li>環境負荷を40%削減した設備を導入</li>
      <li>従業員満足度が92%に向上</li>`,
    page_number: "6",
  },
  // Two-column: Text + Media (merged from twocol-text-visual + twocol-text-image)
  "twocol-text-media": {
    title: "市場成長予測",
    body: "国内DX市場は2030年までに3倍に成長する見通しです。",
    bullets: `<li>2024年: 4,200億円</li>
      <li>2027年: 8,100億円（予測）</li>
      <li>2030年: 1.26兆円（予測）</li>`,
    media: `<svg viewBox="0 0 340 240" width="340" height="240">
      <line x1="40" y1="20" x2="320" y2="20" stroke="#E8D5C4" stroke-width="0.5"/>
      <line x1="40" y1="80" x2="320" y2="80" stroke="#E8D5C4" stroke-width="0.5"/>
      <line x1="40" y1="140" x2="320" y2="140" stroke="#E8D5C4" stroke-width="0.5"/>
      <line x1="40" y1="200" x2="320" y2="200" stroke="#E8D5C4" stroke-width="0.5"/>
      <text x="35" y="24" font-size="10" fill="#666" text-anchor="end">1.2兆</text>
      <text x="35" y="84" font-size="10" fill="#666" text-anchor="end">0.8兆</text>
      <text x="35" y="144" font-size="10" fill="#666" text-anchor="end">0.4兆</text>
      <rect x="70" y="140" width="50" height="60" rx="4" fill="#1A2B4A"/>
      <rect x="155" y="80" width="50" height="120" rx="4" fill="#1A2B4A"/>
      <rect x="240" y="20" width="50" height="180" rx="4" fill="#6B8E7F"/>
      <text x="95" y="220" font-size="10" fill="#2A2A2A" text-anchor="middle">2024</text>
      <text x="180" y="220" font-size="10" fill="#2A2A2A" text-anchor="middle">2027</text>
      <text x="265" y="220" font-size="10" fill="#2A2A2A" text-anchor="middle">2030</text>
    </svg>`,
    page_number: "10",
  },
  // Two-column: Media + Text (reversed)
  "twocol-media-text": {
    title: "最新の導入実績",
    media: `<div class="image-placeholder image-placeholder--full" style="min-height:260px;">オフィス写真</div>`,
    body: "大手製造業A社様にて、生産管理システムのDXを実施。従来の紙ベース管理から完全デジタル化を達成しました。",
    bullets: `<li>生産ライン稼働率が12%向上</li>
      <li>在庫管理コストを年間3,200万円削減</li>
      <li>リードタイムを平均40%短縮</li>`,
    page_number: "25",
  },
  // Two-column: Statement
  "twocol-statement": {
    label: "VISION 2030",
    statement: "日本のDXを\nリードする存在へ",
    description: "2030年までに国内企業1,000社のデジタル変革を支援し、日本の生産性を世界トップレベルに引き上げることを目指します。データとAIを核とした次世代ソリューションで、クライアントの成長を加速させます。",
    page_number: "5",
  },

  // TOC
  "toc-numbered": {
    title: "目次",
    toc_items: `<div class="toc-item">
        <span class="toc-number">01</span>
        <span class="toc-title">現状課題の整理</span>
        <span class="toc-line"></span>
        <span class="toc-page">03</span>
      </div>
      <div class="toc-item">
        <span class="toc-number">02</span>
        <span class="toc-title">提案ソリューション</span>
        <span class="toc-line"></span>
        <span class="toc-page">07</span>
      </div>
      <div class="toc-item">
        <span class="toc-number">03</span>
        <span class="toc-title">導入プロセスとスケジュール</span>
        <span class="toc-line"></span>
        <span class="toc-page">12</span>
      </div>
      <div class="toc-item">
        <span class="toc-number">04</span>
        <span class="toc-title">投資対効果</span>
        <span class="toc-line"></span>
        <span class="toc-page">16</span>
      </div>
      <div class="toc-item">
        <span class="toc-number">05</span>
        <span class="toc-title">会社概要</span>
        <span class="toc-line"></span>
        <span class="toc-page">19</span>
      </div>`,
    page_number: "2",
  },
  "toc-simple": {
    title: "Contents",
    toc_items: `<div class="toc-item">
        <span class="toc-number">01</span>
        <span class="toc-title">市場分析</span>
      </div>
      <div class="toc-item">
        <span class="toc-number">02</span>
        <span class="toc-title">戦略提案</span>
      </div>
      <div class="toc-item">
        <span class="toc-number">03</span>
        <span class="toc-title">実行計画</span>
      </div>
      <div class="toc-item">
        <span class="toc-number">04</span>
        <span class="toc-title">費用・効果</span>
      </div>`,
    page_number: "2",
  },

  // Section: Statement (migrated from statement-centered)
  "section-statement": {
    label: "OUR MISSION",
    statement: "テクノロジーの力で、\nすべての人の可能性を解放する",
    description: "私たちは最先端の技術と人間中心のデザインを融合し、社会に新たな価値を創造します。",
    page_number: "4",
  },

  // Three-column
  "threecol-numbered-cards": {
    title: "成功を支える3つの柱",
    key_message: "戦略・技術・運用の三位一体で成功率を最大化",
    description: "各フェーズの専門チームが連携してプロジェクトを推進します。",
    cards: `<div style="padding:24px; background:var(--white); border-radius:12px; border:1px solid var(--beige);">
        <div style="font-size:32px; font-weight:800; color:var(--green); margin-bottom:8px;">01</div>
        <p class="body-text" style="font-weight:700; margin-bottom:6px;">戦略設計</p>
        <p class="caption">ビジネス目標から逆算した実行可能な戦略を策定</p>
      </div>
      <div style="padding:24px; background:var(--white); border-radius:12px; border:1px solid var(--beige);">
        <div style="font-size:32px; font-weight:800; color:var(--green); margin-bottom:8px;">02</div>
        <p class="body-text" style="font-weight:700; margin-bottom:6px;">技術実装</p>
        <p class="caption">最適な技術スタックで迅速かつ堅牢なシステムを構築</p>
      </div>
      <div style="padding:24px; background:var(--white); border-radius:12px; border:1px solid var(--beige);">
        <div style="font-size:32px; font-weight:800; color:var(--green); margin-bottom:8px;">03</div>
        <p class="body-text" style="font-weight:700; margin-bottom:6px;">運用定着</p>
        <p class="caption">導入後の定着支援と継続的な改善サイクルを実現</p>
      </div>`,
    conclusion: "3つの柱を統合的にサポートすることで、DX推進の成功率を大幅に向上させます。",
    page_number: "9",
  },
  "threecol-icon-cards": {
    title: "サービスの特長",
    key_message: "高速導入×万全の安全性×専任サポートで安心のDX推進",
    description: "お客様のビジネスを止めない、信頼のサービス体制です。",
    cards: `<div style="padding:24px; background:var(--white); border-radius:12px; border:1px solid var(--beige); text-align:center;">
        <div class="icon-circle icon-circle--green" style="margin:0 auto 12px;">{{icon:mdi:lightning-bolt}}</div>
        <p class="body-text" style="font-weight:700; margin-bottom:6px;">高速導入</p>
        <p class="caption">最短2週間でシステムを稼働開始</p>
      </div>
      <div style="padding:24px; background:var(--white); border-radius:12px; border:1px solid var(--beige); text-align:center;">
        <div class="icon-circle" style="margin:0 auto 12px;">{{icon:mdi:shield-check}}</div>
        <p class="body-text" style="font-weight:700; margin-bottom:6px;">万全の安全性</p>
        <p class="caption">ISO27001準拠のセキュリティ基盤</p>
      </div>
      <div style="padding:24px; background:var(--white); border-radius:12px; border:1px solid var(--beige); text-align:center;">
        <div class="icon-circle icon-circle--green" style="margin:0 auto 12px;">{{icon:mdi:headset}}</div>
        <p class="body-text" style="font-weight:700; margin-bottom:6px;">専任サポート</p>
        <p class="caption">24時間365日の専門チーム体制</p>
      </div>`,
    page_number: "10",
  },

  // Content: Timeline (migrated from timeline-horizontal)
  "content-timeline": {
    title: "沿革",
    key_message: "創業8年で導入企業500社を突破、着実な成長を継続",
    description: "2018年の設立から現在までの主要マイルストーンをご紹介します。",
    timeline_nodes: `<div class="timeline-node">
        <div class="timeline-dot timeline-dot--active"></div>
        <div class="timeline-year">2018</div>
        <div class="timeline-content">会社設立</div>
      </div>
      <div class="timeline-node">
        <div class="timeline-dot"></div>
        <div class="timeline-year">2020</div>
        <div class="timeline-content">SaaS事業開始</div>
      </div>
      <div class="timeline-node">
        <div class="timeline-dot"></div>
        <div class="timeline-year">2022</div>
        <div class="timeline-content">シリーズA調達</div>
      </div>
      <div class="timeline-node">
        <div class="timeline-dot timeline-dot--active"></div>
        <div class="timeline-year">2024</div>
        <div class="timeline-content">導入企業500社突破</div>
      </div>
      <div class="timeline-node">
        <div class="timeline-dot"></div>
        <div class="timeline-year">2026</div>
        <div class="timeline-content">AI機能リリース</div>
      </div>`,
    page_number: "21",
  },

  // Content: Person (migrated from person-message)
  "content-person": {
    title: "代表メッセージ",
    initials: "YT",
    name: "山田 太郎",
    role: "代表取締役CEO",
    message: "創業以来、「テクノロジーで人を幸せにする」という想いを胸に事業を展開してまいりました。お客様の課題に真摯に向き合い、最適なソリューションを提供することで、日本のデジタル変革に貢献してまいります。",
    page_number: "22",
  },
};

/* ─── Generate preview HTML ─── */

function generatePreview(): string {
  const slides: string[] = [];

  for (const [id, template] of Object.entries(registry.templates)) {
    const data = SAMPLE_DATA[id];
    if (!data) continue;

    let html = template.html;
    // Replace placeholders with sample data
    for (const [key, value] of Object.entries(data)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }

    // Category label
    const label = `<div style="padding:8px 16px; background:#f0f0f0; font-family:monospace; font-size:12px; color:#666;">
      ${template.category} / <strong>${template.id}</strong> — ${template.name}
    </div>`;

    slides.push(`${label}\n<div style="margin:0 auto 40px; box-shadow:0 4px 20px rgba(0,0,0,0.15); border-radius:4px; overflow:hidden;">\n${html}\n</div>`);
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1060">
  <title>Slide Template Preview</title>
  <style>
    ${BASE_STYLES}
    body {
      background: #e8e8e8;
      padding: 40px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    h1 {
      text-align: center;
      color: #333;
      margin-bottom: 8px;
      font-size: 24px;
    }
    .meta {
      text-align: center;
      color: #888;
      margin-bottom: 40px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>Slide Template Preview</h1>
  <p class="meta">${Object.keys(registry.templates).length} templates</p>
  ${slides.join("\n")}
</body>
</html>`;
}

/* ─── Write to file ─── */

import { writeFileSync } from "fs";
import { resolve } from "path";

const outPath = resolve(process.cwd(), "template-preview.html");
writeFileSync(outPath, generatePreview(), "utf-8");
console.log(`Preview written to: ${outPath}`);
