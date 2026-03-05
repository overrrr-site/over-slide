import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { StepBar } from "./step-bar";
import { ProjectChatWrapper } from "./chat/project-chat-wrapper";
import { ProjectHeaderMeta } from "./project-header-meta";

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
              { label: "資料作成", href: "/projects" },
              { label: project.title },
            ]}
          />
        </div>

        <div className="flex items-center justify-between">
          <ProjectHeaderMeta
            projectId={projectId}
            initialTitle={project.title}
            initialClientName={project.client_name || ""}
          />
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Icon icon="mdi:presentation" className="h-4 w-4" />
            スライド
          </div>
        </div>

        <StepBar projectId={projectId} currentStep={project.current_step} />
      </div>

      {/* Step content + Chat panel */}
      <ProjectChatWrapper>{children}</ProjectChatWrapper>
    </div>
  );
}
