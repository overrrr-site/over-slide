# OOUI + HIG 全面リデザイン 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** OOUI（オブジェクト指向UI）とHIG（ヒューマンインターフェースガイドライン）の原則に基づき、OVERworksのUI全体を刷新する。

**Architecture:** 共通UIコンポーネント（Button, Card, Badge等）を `components/ui/` に作成し、ダッシュボードを統合ハブ化、プロジェクト一覧をカードグリッドに、見積一覧をテーブル形式に変更する。全画面にパンくずリスト・統一PageHeaderを導入する。

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4, @iconify/react, Supabase

**参照ドキュメント:**
- `documents/ooui-redesign-plan.md` — 設計の全体像
- `documents/ooui-guidelines.md` — OOUI原則
- `documents/hig-design-principles.md` — HIG原則
- `documents/ooui-hig-application.md` — 適用ガイド・チェックリスト

---

## Task 1: Button コンポーネント

**Files:**
- Create: `components/ui/button.tsx`

**Step 1: ファイル作成**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-navy text-white hover:bg-navy/90 focus-visible:ring-green",
  secondary:
    "border border-beige bg-white text-text-primary hover:bg-off-white focus-visible:ring-green",
  danger:
    "bg-status-error-bg text-status-error-text hover:bg-red-100 focus-visible:ring-red-400",
  ghost:
    "text-text-secondary hover:bg-off-white hover:text-text-primary focus-visible:ring-green",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-2.5 text-base",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
```

**Step 2: 動作確認**

Run: `npx next build` (型エラーがないことを確認)

**Step 3: コミット**

```bash
git add components/ui/button.tsx
git commit -m "feat: add Button shared component (primary/secondary/danger/ghost)"
```

---

## Task 2: Badge コンポーネント

**Files:**
- Create: `components/ui/badge.tsx`

**Step 1: ファイル作成**

```tsx
type BadgeVariant = "draft" | "active" | "warning" | "success" | "error" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  draft: "bg-status-draft-bg text-status-draft-text",
  active: "bg-status-active-bg text-status-active-text",
  warning: "bg-status-warning-bg text-status-warning-text",
  success: "bg-status-success-bg text-status-success-text",
  error: "bg-status-error-bg text-status-error-text",
  info: "bg-blue-50 text-blue-700",
};

export function Badge({ variant = "draft", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
```

**Step 2: コミット**

```bash
git add components/ui/badge.tsx
git commit -m "feat: add Badge shared component (6 variants)"
```

---

## Task 3: Card コンポーネント

**Files:**
- Create: `components/ui/card.tsx`

**Step 1: ファイル作成**

```tsx
import Link from "next/link";

interface CardProps {
  children: React.ReactNode;
  href?: string;
  className?: string;
  interactive?: boolean;
}

export function Card({ children, href, className = "", interactive = false }: CardProps) {
  const baseStyles = "rounded-xl border border-beige bg-white p-5";
  const interactiveStyles = interactive
    ? "transition-all hover:border-green/50 hover:shadow-md"
    : "";

  if (href) {
    return (
      <Link
        href={href}
        className={`block ${baseStyles} ${interactiveStyles} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green focus-visible:ring-offset-2 ${className}`}
      >
        {children}
      </Link>
    );
  }

  return (
    <div className={`${baseStyles} ${interactiveStyles} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-start justify-between ${className}`}>{children}</div>;
}

export function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mt-3 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mt-3 flex items-center gap-3 text-xs text-text-secondary ${className}`}>
      {children}
    </div>
  );
}
```

**Step 2: コミット**

```bash
git add components/ui/card.tsx
git commit -m "feat: add Card shared component (with header/content/footer)"
```

---

## Task 4: Breadcrumb コンポーネント

**Files:**
- Create: `components/ui/breadcrumb.tsx`

**Step 1: ファイル作成**

```tsx
import Link from "next/link";
import { Icon } from "@iconify/react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="パンくずリスト" className="flex items-center gap-1 text-xs text-text-secondary">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <Icon icon="mdi:chevron-right" className="h-3.5 w-3.5 text-beige" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-navy transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-text-primary font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

**Step 2: コミット**

```bash
git add components/ui/breadcrumb.tsx
git commit -m "feat: add Breadcrumb navigation component"
```

---

## Task 5: PageHeader コンポーネント

**Files:**
- Create: `components/ui/page-header.tsx`

**Step 1: ファイル作成**

```tsx
import { Breadcrumb, type BreadcrumbItem } from "./breadcrumb";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs && (
        <div className="mb-3">
          <Breadcrumb items={breadcrumbs} />
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-text-secondary">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
```

**Step 2: コミット**

```bash
git add components/ui/page-header.tsx
git commit -m "feat: add PageHeader component with breadcrumb support"
```

---

## Task 6: ProgressBar コンポーネント

**Files:**
- Create: `components/ui/progress-bar.tsx`

**Step 1: ファイル作成**

```tsx
interface ProgressBarProps {
  current: number;
  total: number;
  className?: string;
}

export function ProgressBar({ current, total, className = "" }: ProgressBarProps) {
  const percentage = Math.min(Math.round((current / total) * 100), 100);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 flex-1 rounded-full bg-beige/60">
        <div
          className="h-full rounded-full bg-green transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-medium text-text-secondary tabular-nums">
        {current}/{total}
      </span>
    </div>
  );
}
```

**Step 2: コミット**

```bash
git add components/ui/progress-bar.tsx
git commit -m "feat: add ProgressBar component for workflow progress"
```

---

## Task 7: EmptyState コンポーネント

**Files:**
- Create: `components/ui/empty-state.tsx`

**Step 1: ファイル作成**

```tsx
import { Icon } from "@iconify/react";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon = "mdi:folder-open-outline",
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-beige px-6 py-16 text-center">
      <Icon icon={icon} className="mb-3 h-10 w-10 text-beige" />
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-text-secondary">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

**Step 2: コミット**

```bash
git add components/ui/empty-state.tsx
git commit -m "feat: add EmptyState component with icon and action slot"
```

---

## Task 8: コンポーネント barrel export

**Files:**
- Create: `components/ui/index.ts`

**Step 1: ファイル作成**

```ts
export { Button } from "./button";
export { Badge } from "./badge";
export { Card, CardHeader, CardContent, CardFooter } from "./card";
export { Breadcrumb, type BreadcrumbItem } from "./breadcrumb";
export { PageHeader } from "./page-header";
export { ProgressBar } from "./progress-bar";
export { EmptyState } from "./empty-state";
```

**Step 2: ビルド確認**

Run: `npx next build`
Expected: ビルド成功（型エラーなし）

**Step 3: コミット**

```bash
git add components/ui/index.ts
git commit -m "feat: add barrel export for UI components"
```

---

## Task 9: サイドバーにホームリンク追加

**Files:**
- Modify: `app/(app)/sidebar-nav.tsx`

**Step 1: サイドバー修正**

変更内容：
1. NAV_GROUPSの前に「ホーム」リンクを追加
2. スタイルの微調整（グループ間の余白統一）

```tsx
// NAV_GROUPS定義の前に追加
const HOME_ITEM: NavItem = {
  href: "/dashboard",
  label: "ホーム",
  icon: "mdi:home-outline",
  iconActive: "mdi:home",
};
```

SidebarNavコンポーネント内、NAV_GROUPSのmapの前に追加:

```tsx
{/* ホーム */}
<div className="mb-2">
  {(() => {
    const active = pathname === "/dashboard";
    return (
      <Link
        href={HOME_ITEM.href}
        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-off-white font-medium text-navy"
            : "text-text-primary hover:bg-off-white/60"
        }`}
      >
        <Icon
          icon={active ? HOME_ITEM.iconActive : HOME_ITEM.icon}
          className={`h-5 w-5 ${active ? "text-navy" : "text-text-secondary"}`}
        />
        {HOME_ITEM.label}
      </Link>
    );
  })()}
</div>
```

NAV_GROUPSのダッシュボード項目のhrefを `/projects` に変更:

```tsx
// 変更前
{ href: "/dashboard", label: "プロジェクト一覧", ... }
// 変更後
{ href: "/projects", label: "プロジェクト一覧", ... }
```

※ `/projects` ページは Task 11 で作成

**Step 2: コミット**

```bash
git add app/(app)/sidebar-nav.tsx
git commit -m "feat: add Home link to sidebar, separate from project list"
```

---

## Task 10: 統合ダッシュボード（ホーム）の作成

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

**Step 1: ダッシュボード書き換え**

既存の `page.tsx` を統合ハブに書き換える。最近のプロジェクト（最大6件カードグリッド）、最近の見積（最大5件コンパクトテーブル）、クイックアクションを1画面に表示。

```tsx
import { createClient } from "@/lib/supabase/server";
import { WORKFLOW_STEPS } from "@/lib/utils/constants";
import { QUOTE_STATUSES } from "@/lib/quotes/constants";
import { formatCurrency } from "@/lib/quotes/calculations";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_BADGE_MAP: Record<string, "draft" | "active" | "warning" | "success"> = {
  draft: "draft",
  in_progress: "active",
  review: "warning",
  completed: "success",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  in_progress: "進行中",
  review: "レビュー",
  completed: "完了",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: quotes }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, client_name, status, current_step, output_type, updated_at")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("quotes")
      .select("id, quote_number, project_name, client_name, total, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const stepName = (step: number) => {
    if (step > WORKFLOW_STEPS[WORKFLOW_STEPS.length - 1].id) return "完了";
    return WORKFLOW_STEPS.find((s) => s.id === step)?.name || "";
  };

  const totalSteps = WORKFLOW_STEPS.length;

  return (
    <div className="mx-auto w-full max-w-6xl overflow-auto p-6">
      <PageHeader
        title="ホーム"
        actions={
          <div className="flex gap-2">
            <Link href="/projects/new">
              <Button size="sm">+ 新規プロジェクト</Button>
            </Link>
            <Link href="/quotes/new">
              <Button variant="secondary" size="sm">+ 新規見積</Button>
            </Link>
          </div>
        }
      />

      {/* 最近のプロジェクト */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy">最近のプロジェクト</h2>
          <Link href="/projects" className="text-xs text-text-secondary hover:text-navy transition-colors">
            すべて見る →
          </Link>
        </div>

        {!projects?.length ? (
          <EmptyState
            icon="mdi:file-presentation-box"
            title="プロジェクトがありません"
            description="新規プロジェクトを作成して始めましょう"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card key={project.id} href={`/projects/${project.id}`} interactive>
                <CardHeader>
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate text-sm font-bold text-navy">
                      {project.title}
                    </h3>
                    {project.client_name && (
                      <p className="mt-0.5 truncate text-xs text-text-secondary">
                        {project.client_name}
                      </p>
                    )}
                  </div>
                  <Badge variant={STATUS_BADGE_MAP[project.status] || "draft"}>
                    {STATUS_LABELS[project.status] || project.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <ProgressBar current={Math.min(project.current_step, totalSteps)} total={totalSteps} />
                  <p className="mt-1.5 text-xs text-text-secondary">
                    現在: {stepName(project.current_step)}
                  </p>
                </CardContent>
                <CardFooter>
                  <span className="flex items-center gap-1">
                    <Icon
                      icon={project.output_type === "document" ? "mdi:file-document-outline" : "mdi:presentation"}
                      className="h-3.5 w-3.5"
                    />
                    {project.output_type === "document" ? "ドキュメント" : "スライド"}
                  </span>
                  <span>
                    {new Date(project.updated_at).toLocaleDateString("ja-JP")}
                  </span>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 最近の見積 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy">最近の見積</h2>
          <Link href="/quotes" className="text-xs text-text-secondary hover:text-navy transition-colors">
            すべて見る →
          </Link>
        </div>

        {!quotes?.length ? (
          <EmptyState
            icon="mdi:calculator-variant-outline"
            title="見積がありません"
            description="新規見積を作成して始めましょう"
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-beige text-left text-xs text-text-secondary">
                    <th className="pb-2 font-medium">案件名</th>
                    <th className="pb-2 font-medium">クライアント</th>
                    <th className="pb-2 font-medium text-right">合計金額</th>
                    <th className="pb-2 font-medium">状態</th>
                    <th className="pb-2 font-medium text-right">更新日</th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((quote) => {
                    const statusConfig = QUOTE_STATUSES[quote.status as keyof typeof QUOTE_STATUSES] || QUOTE_STATUSES.draft;
                    return (
                      <tr key={quote.id} className="border-b border-beige/50 last:border-0">
                        <td className="py-2.5">
                          <Link href={`/quotes/${quote.id}`} className="font-medium text-navy hover:underline">
                            {quote.project_name || "無題"}
                          </Link>
                        </td>
                        <td className="py-2.5 text-text-secondary">
                          {quote.client_name || "—"}
                        </td>
                        <td className="py-2.5 text-right font-en font-medium">
                          ¥{formatCurrency(quote.total)}
                        </td>
                        <td className="py-2.5">
                          <Badge variant={quote.status === "won" ? "success" : quote.status === "lost" ? "error" : quote.status === "submitted" ? "active" : "draft"}>
                            {statusConfig.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right text-text-secondary">
                          {new Date(quote.updated_at).toLocaleDateString("ja-JP")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
```

**Step 2: ビルド確認**

Run: `npx next build`

**Step 3: dev serverで表示確認**

Run: `npm run dev`
確認: `http://localhost:3000/dashboard` でプロジェクトカード + 見積テーブルが表示されること

**Step 4: コミット**

```bash
git add app/(app)/dashboard/page.tsx
git commit -m "feat: redesign dashboard as unified hub (projects + quotes)"
```

---

## Task 11: プロジェクト一覧ページの作成

**Files:**
- Create: `app/(app)/projects/page.tsx`

**Step 1: プロジェクト一覧の全件表示ページ作成**

ダッシュボードは最新6件だけ表示するので、全件表示用のページを別に作る。カードグリッド + ステータスフィルター付き。

```tsx
import { createClient } from "@/lib/supabase/server";
import { WORKFLOW_STEPS } from "@/lib/utils/constants";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const STATUS_BADGE_MAP: Record<string, "draft" | "active" | "warning" | "success"> = {
  draft: "draft",
  in_progress: "active",
  review: "warning",
  completed: "success",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  in_progress: "進行中",
  review: "レビュー",
  completed: "完了",
};

export default async function ProjectsListPage() {
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title, client_name, status, current_step, output_type, updated_at")
    .order("updated_at", { ascending: false });

  const stepName = (step: number) => {
    if (step > WORKFLOW_STEPS[WORKFLOW_STEPS.length - 1].id) return "完了";
    return WORKFLOW_STEPS.find((s) => s.id === step)?.name || "";
  };

  const totalSteps = WORKFLOW_STEPS.length;

  return (
    <div className="mx-auto w-full max-w-6xl overflow-auto p-6">
      <PageHeader
        title="プロジェクト一覧"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "プロジェクト" },
        ]}
        actions={
          <Link href="/projects/new">
            <Button size="sm">+ 新規プロジェクト</Button>
          </Link>
        }
      />

      {!projects?.length ? (
        <EmptyState
          icon="mdi:file-presentation-box"
          title="プロジェクトがありません"
          description="「新規プロジェクト」ボタンからプロジェクトを作成してください"
          action={
            <Link href="/projects/new">
              <Button size="sm">+ 新規プロジェクト</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} href={`/projects/${project.id}`} interactive>
              <CardHeader>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate text-sm font-bold text-navy">
                    {project.title}
                  </h3>
                  {project.client_name && (
                    <p className="mt-0.5 truncate text-xs text-text-secondary">
                      {project.client_name}
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_BADGE_MAP[project.status] || "draft"}>
                  {STATUS_LABELS[project.status] || project.status}
                </Badge>
              </CardHeader>
              <CardContent>
                <ProgressBar current={Math.min(project.current_step, totalSteps)} total={totalSteps} />
                <p className="mt-1.5 text-xs text-text-secondary">
                  現在: {stepName(project.current_step)}
                </p>
              </CardContent>
              <CardFooter>
                <span className="flex items-center gap-1">
                  <Icon
                    icon={project.output_type === "document" ? "mdi:file-document-outline" : "mdi:presentation"}
                    className="h-3.5 w-3.5"
                  />
                  {project.output_type === "document" ? "ドキュメント" : "スライド"}
                </span>
                <span>
                  {new Date(project.updated_at).toLocaleDateString("ja-JP")}
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: コミット**

```bash
git add app/(app)/projects/page.tsx
git commit -m "feat: add projects list page with card grid and progress bars"
```

---

## Task 12: プロジェクト詳細ヘッダー改善（パンくず + ステップバー改良）

**Files:**
- Modify: `app/(app)/projects/[projectId]/layout.tsx`
- Modify: `app/(app)/projects/[projectId]/step-bar.tsx`

**Step 1: ステップバー改良（3状態表示 + チェックマーク）**

`step-bar.tsx` を修正:
- 完了ステップに ✓ マーク追加
- 進行中ステップを視覚的に強調
- 未着手ステップは控えめに

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { WORKFLOW_STEPS, DOCUMENT_STEP_NAMES } from "@/lib/utils/constants";

interface StepBarProps {
  projectId: string;
  currentStep: number;
  outputType?: string;
}

export function StepBar({ projectId, currentStep, outputType = "slide" }: StepBarProps) {
  const pathname = usePathname();

  const currentPathStep = WORKFLOW_STEPS.find((step) => {
    const stepPath = `/projects/${projectId}/${step.path}`;
    return pathname === stepPath || pathname.startsWith(stepPath + "/");
  });

  const activeStepId = currentPathStep?.id ?? currentStep;

  return (
    <div className="mt-3 flex gap-1">
      {WORKFLOW_STEPS.map((step) => {
        const isViewing = step.id === activeStepId;
        const isCompleted = step.id < currentStep;
        const stepPath = `/projects/${projectId}/${step.path}`;
        const stepLabel = outputType === "document" && DOCUMENT_STEP_NAMES[step.id]
          ? DOCUMENT_STEP_NAMES[step.id]
          : step.name;

        return (
          <Link
            key={step.id}
            href={stepPath}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors ${
              isViewing
                ? "bg-navy text-white shadow-sm"
                : isCompleted
                  ? "bg-green/15 text-green"
                  : "bg-off-white text-text-secondary hover:bg-beige/40"
            }`}
          >
            {isCompleted && (
              <Icon icon="mdi:check-circle" className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{step.id}. {stepLabel}</span>
          </Link>
        );
      })}
    </div>
  );
}
```

**Step 2: プロジェクト詳細レイアウトにパンくずと戻り導線を追加**

`layout.tsx` を修正:

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StepBar } from "./step-bar";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, client_name, current_step, status, output_type")
    .eq("id", projectId)
    .single();

  if (!project) {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-full flex-col">
      {/* Project header */}
      <div className="border-b border-beige bg-white px-6 py-3">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/projects"
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-navy transition-colors"
          >
            <Icon icon="mdi:arrow-left" className="h-4 w-4" />
            一覧に戻る
          </Link>
          <Breadcrumb
            items={[
              { label: "ホーム", href: "/dashboard" },
              { label: "プロジェクト", href: "/projects" },
              { label: project.title },
            ]}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-navy">{project.title}</h1>
            {project.client_name && (
              <p className="text-xs text-text-secondary">
                {project.client_name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Icon
              icon={project.output_type === "document" ? "mdi:file-document-outline" : "mdi:presentation"}
              className="h-4 w-4"
            />
            {project.output_type === "document" ? "ドキュメント" : "スライド"}
          </div>
        </div>

        <StepBar projectId={projectId} currentStep={project.current_step} outputType={project.output_type || "slide"} />
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
```

**Step 3: コミット**

```bash
git add app/(app)/projects/[projectId]/layout.tsx app/(app)/projects/[projectId]/step-bar.tsx
git commit -m "feat: add breadcrumb, back link, and improved step bar to project detail"
```

---

## Task 13: 見積一覧のテーブル化

**Files:**
- Modify: `app/(app)/quotes/page.tsx`

**Step 1: テーブル形式に書き換え**

```tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { QUOTE_STATUSES } from "@/lib/quotes/constants";
import { formatCurrency } from "@/lib/quotes/calculations";
import { QuoteListActions } from "./quote-list-actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

const BADGE_VARIANT_MAP: Record<string, "draft" | "active" | "success" | "error"> = {
  draft: "draft",
  submitted: "active",
  won: "success",
  lost: "error",
};

export default async function QuotesListPage() {
  const supabase = await createClient();

  const { data: quotes } = await supabase
    .from("quotes")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-6xl overflow-auto p-6">
      <PageHeader
        title="見積一覧"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "見積" },
        ]}
        actions={
          <Link href="/quotes/new">
            <Button size="sm">+ 新規見積</Button>
          </Link>
        }
      />

      {!quotes?.length ? (
        <EmptyState
          icon="mdi:calculator-variant-outline"
          title="見積がありません"
          description="「新規見積」ボタンから見積を作成してください"
          action={
            <Link href="/quotes/new">
              <Button size="sm">+ 新規見積</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-beige text-left text-xs text-text-secondary">
                  <th className="pb-2.5 font-medium">見積番号</th>
                  <th className="pb-2.5 font-medium">案件名</th>
                  <th className="pb-2.5 font-medium">クライアント</th>
                  <th className="pb-2.5 font-medium text-right">合計金額（税込）</th>
                  <th className="pb-2.5 font-medium">状態</th>
                  <th className="pb-2.5 font-medium text-right">更新日</th>
                  <th className="pb-2.5 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => {
                  const statusConfig =
                    QUOTE_STATUSES[quote.status as keyof typeof QUOTE_STATUSES] ||
                    QUOTE_STATUSES.draft;
                  return (
                    <tr key={quote.id} className="border-b border-beige/50 last:border-0 hover:bg-off-white/50 transition-colors">
                      <td className="py-3 font-en text-xs text-text-secondary">
                        {quote.quote_number}
                      </td>
                      <td className="py-3">
                        <Link href={`/quotes/${quote.id}`} className="font-medium text-navy hover:underline">
                          {quote.project_name || "無題の見積"}
                        </Link>
                      </td>
                      <td className="py-3 text-text-secondary">
                        {quote.client_name || "—"}
                      </td>
                      <td className="py-3 text-right font-en font-medium text-navy">
                        ¥{formatCurrency(quote.total)}
                      </td>
                      <td className="py-3">
                        <Badge variant={BADGE_VARIANT_MAP[quote.status] || "draft"}>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="py-3 text-right text-xs text-text-secondary">
                        {new Date(quote.updated_at).toLocaleDateString("ja-JP")}
                      </td>
                      <td className="py-3 text-right">
                        <QuoteListActions quoteId={quote.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: コミット**

```bash
git add app/(app)/quotes/page.tsx
git commit -m "feat: redesign quotes list as table with PageHeader and breadcrumb"
```

---

## Task 14: 見積アクションボタンをButtonコンポーネントに置き換え

**Files:**
- Modify: `app/(app)/quotes/quote-list-actions.tsx`
- Modify: `app/(app)/dashboard/project-list-actions.tsx`

**Step 1: QuoteListActionsのボタンをButtonコンポーネントに**

既存の `quote-list-actions.tsx` のボタン要素を `<Button variant="ghost" size="sm">` に置き換え。

**Step 2: ProjectListActionsも同様に**

既存の `project-list-actions.tsx` のボタン要素を `<Button>` に置き換え。

**Step 3: コミット**

```bash
git add app/(app)/quotes/quote-list-actions.tsx app/(app)/dashboard/project-list-actions.tsx
git commit -m "refactor: replace inline buttons with Button component in list actions"
```

---

## Task 15: 全体ビルド確認 + 画面の目視検証

**Step 1: ビルド**

Run: `npx next build`
Expected: エラーなしでビルド成功

**Step 2: dev serverで全画面を確認**

Run: `npm run dev`

確認リスト:
- [ ] `/dashboard` — プロジェクトカード（進捗バー付き）+ 見積テーブルが表示
- [ ] `/projects` — プロジェクト全件がカードグリッドで表示
- [ ] `/projects/[id]` — パンくず + 戻るリンク + 改良ステップバーが表示
- [ ] `/quotes` — テーブル形式で見積一覧が表示
- [ ] サイドバー — ホームリンクが表示、プロジェクト一覧が `/projects` に遷移

**Step 3: OOUI+HIGチェック（`documents/ooui-hig-application.md` セクション6）**

- [ ] ダッシュボードがオブジェクト起点になっているか
- [ ] パンくずで「今どこにいるか」が分かるか
- [ ] Badge/Button/Cardの見た目が全画面で統一されているか

**Step 4: 最終コミット**

```bash
git add -A
git commit -m "feat: OOUI+HIG redesign phase 1 complete - components, dashboard, navigation"
```

---

## Summary

| Task | 内容 | 新規/修正 |
|------|------|----------|
| 1-7 | 共通UIコンポーネント 7種 | 新規作成 |
| 8 | barrel export | 新規作成 |
| 9 | サイドバーにホームリンク追加 | 修正 |
| 10 | 統合ダッシュボード | 修正（書き換え） |
| 11 | プロジェクト一覧ページ | 新規作成 |
| 12 | プロジェクト詳細ヘッダー改善 | 修正 |
| 13 | 見積一覧テーブル化 | 修正（書き換え） |
| 14 | アクションボタン統一 | 修正 |
| 15 | 全体確認 | 検証 |
