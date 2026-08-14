import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function UserDetailValue({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="min-h-5 text-xs font-medium">{value}</div>
    </div>
  );
}
