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
