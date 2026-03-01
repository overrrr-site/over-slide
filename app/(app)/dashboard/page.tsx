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
