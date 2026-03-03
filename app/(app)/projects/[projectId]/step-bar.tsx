"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@iconify/react";
import { DOCUMENT_STEP_NAMES, getWorkflowSteps } from "@/lib/utils/constants";

interface StepBarProps {
  projectId: string;
  currentStep: number;
  outputType?: string;
}

export function StepBar({ projectId, currentStep, outputType = "slide" }: StepBarProps) {
  const pathname = usePathname();
  const steps = getWorkflowSteps(outputType);

  const currentPathStep = steps.find((step) => {
    const stepPath = `/projects/${projectId}/${step.path}`;
    return pathname === stepPath || pathname.startsWith(stepPath + "/");
  });

  const activeStepId = currentPathStep?.id ?? currentStep;

  return (
    <div className="mt-3 flex gap-1">
      {steps.map((step) => {
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
