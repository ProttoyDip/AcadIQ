import { Loader2 } from "lucide-react";
import { Skeleton } from "./skeleton";
import { cn } from "../../lib/utils";

export function LoadingState({ label = "Loading...", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-14 text-muted-foreground", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
      <p className="text-small">{label}</p>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-16" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}
