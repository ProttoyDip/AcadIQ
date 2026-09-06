import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: { value: string; direction: "up" | "down"; positive?: boolean };
  index?: number;
}

export default function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <Card className="hover:border-primary-200 dark:hover:border-primary-800 transition-colors shadow-xs">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
            <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/60 border border-primary-100 dark:border-primary-800/80">
            <Icon className="h-5 w-5 text-primary-700 dark:text-primary-300" strokeWidth={1.75} />
          </div>
        </div>
        {trend && (
          <div
            className={cn(
              "mt-3 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
              trend.positive === false
                ? "bg-error-bg text-error border border-error-border"
                : "bg-success-bg text-success border border-success-border"
            )}
          >
            {trend.direction === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            <span className="font-semibold tabular-nums">{trend.value}</span>
            <span className="text-muted-foreground ml-0.5">vs last semester</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
