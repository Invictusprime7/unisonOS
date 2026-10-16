import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import type { RouteBreadcrumbItem } from "@/routes";

interface ShellBreadcrumbsProps {
  items: RouteBreadcrumbItem[];
  className?: string;
}

export function ShellBreadcrumbs({ items, className }: ShellBreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn("flex min-w-0 items-center gap-1 text-xs text-muted-foreground", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const label = <span className={cn("truncate", isLast && "font-medium text-foreground")}>{item.label}</span>;

        return (
          <span key={`${item.id}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            {item.href && !isLast ? (
              <Link to={item.href} className="truncate transition-colors hover:text-foreground hover:underline hover:decoration-primary hover:underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {label}
              </Link>
            ) : (
              label
            )}
          </span>
        );
      })}
    </nav>
  );
}

