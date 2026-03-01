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
