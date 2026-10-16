import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import type { RouteNavItem } from "@/routes";

interface ShellNavProps {
  items: RouteNavItem[];
  className?: string;
}

export function ShellNav({ items, className }: ShellNavProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Shell navigation" className={cn("flex min-w-0 items-center gap-1 overflow-x-auto", className)}>
      {items.map((item) => {
        const content = (
          <span
            className={cn(
              "inline-flex h-9 items-center px-2 text-sm transition-colors",
              item.isActive
                ? "text-foreground underline decoration-primary underline-offset-4"
                : "text-muted-foreground hover:text-foreground hover:underline hover:decoration-primary hover:underline-offset-4",
              !item.href && "cursor-not-allowed opacity-50",
            )}
          >
            {item.label}
          </span>
        );

        return item.href ? (
          <Link
            key={item.id}
            to={item.href}
            aria-current={item.isActive ? "page" : undefined}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {content}
          </Link>
        ) : (
          <span key={item.id} aria-disabled="true">
            {content}
          </span>
        );
      })}
    </nav>
  );
}

