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
