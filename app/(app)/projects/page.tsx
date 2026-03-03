import { createClient } from "@/lib/supabase/server";
import { getWorkflowSteps } from "@/lib/utils/constants";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectDeleteAction } from "./project-delete-action";

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

  const stepName = (step: number, outputType?: string) => {
    const steps = getWorkflowSteps(outputType);
    if (step > steps[steps.length - 1].id) return "完了";
    return steps.find((s) => s.id === step)?.name || "";
  };

  const totalStepsFor = (outputType?: string) => getWorkflowSteps(outputType).length;

  return (
    <div className="mx-auto w-full max-w-6xl overflow-auto p-6">
      <PageHeader
        title="資料作成一覧"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "資料作成" },
        ]}
        actions={
          <Link href="/brainstorms/new">
            <Button size="sm">+ 新規ブレスト</Button>
          </Link>
        }
      />

      {!projects?.length ? (
        <EmptyState
          icon="mdi:file-presentation-box"
          title="資料作成がありません"
          description="「新規ブレスト」から企画書を作成してください"
          action={
            <Link href="/brainstorms/new">
              <Button size="sm">+ 新規ブレスト</Button>
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
                <ProgressBar current={Math.min(project.current_step, totalStepsFor(project.output_type))} total={totalStepsFor(project.output_type)} />
                <p className="mt-1.5 text-xs text-text-secondary">
                  現在: {stepName(project.current_step, project.output_type)}
                </p>
              </CardContent>
              <CardFooter className="justify-between">
                <span className="flex items-center gap-1">
                  <Icon
                    icon={project.output_type === "document" ? "mdi:file-document-outline" : "mdi:presentation"}
                    className="h-3.5 w-3.5"
                  />
                  {project.output_type === "document" ? "ドキュメント" : "スライド"}
                </span>
                <span className="flex items-center gap-2">
                  <span>{new Date(project.updated_at).toLocaleDateString("ja-JP")}</span>
                  <ProjectDeleteAction projectId={project.id} />
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
