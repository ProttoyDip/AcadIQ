import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

interface RiskCardProps {
  level: RiskLevel;
  icon: LucideIcon;
  category: string;
  finding: string;
  active: boolean;
  index?: number;
}

const levelStyles: Record<
  RiskLevel,
  { badge: string; border: string; icon: string; tag: string; dot: string }
> = {
  HIGH: {
    badge: "bg-error-bg text-error border-error-border",
    border: "border-l-error",
    icon: "text-error",
    tag: "High Risk · Action Recommended",
    dot: "bg-error",
  },
  MEDIUM: {
    badge: "bg-warning-bg text-warning border-warning-border",
    border: "border-l-warning",
    icon: "text-warning",
    tag: "Moderate · Advisory",
    dot: "bg-warning",
  },
  LOW: {
    badge: "bg-success-bg text-success border-success-border",
    border: "border-l-success",
    icon: "text-success",
    tag: "Low Risk · Aligned",
    dot: "bg-success",
  },
};

export default function RiskCard({ level, icon: Icon, category, finding, active }: RiskCardProps) {
  const styles = levelStyles[level];

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-all shadow-2xs",
        active ? cn("border-l-4", styles.border) : "border-l-4 border-l-border"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide",
            active ? styles.badge : "bg-muted text-muted-foreground border-border"
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", active ? styles.dot : "bg-muted-foreground/50")} />
          {active ? styles.tag : "Normal · Conforming"}
        </span>
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            active ? "bg-muted/80" : "bg-muted/40"
          )}
        >
          <Icon className={cn("h-4 w-4", active ? styles.icon : "text-muted-foreground/40")} />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground tracking-tight">{category}</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{finding}</p>
      </div>
    </div>
  );
}
