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
