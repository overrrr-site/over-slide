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
