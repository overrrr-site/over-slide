import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getWorkflowSteps } from "@/lib/utils/constants";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("current_step, output_type")
    .eq("id", projectId)
    .single();

  const steps = getWorkflowSteps();
  const minStep = steps[0].id;
  const maxStep = steps[steps.length - 1].id;
  const currentStepValue = project?.current_step ?? minStep;

  const currentStep = steps.find((s) => s.id === currentStepValue)
    ?? (currentStepValue > maxStep
      ? steps[steps.length - 1]
      : steps[0]);

  redirect(`/projects/${projectId}/${currentStep.path}`);
}
