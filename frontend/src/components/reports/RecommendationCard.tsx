import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { priorityTone } from "../../lib/format";
import { Priority } from "../../types";

interface RecommendationCardProps {
  message: string;
  priority: Priority;
  index?: number;
}

const severityIcon: Record<Priority, typeof AlertTriangle> = {
  HIGH: AlertTriangle,
  MEDIUM: AlertCircle,
  LOW: Info,
};

const severityStyles: Record<
  Priority,
  { border: string; iconColor: string; tag: string }
> = {
  HIGH: { border: "border-l-error", iconColor: "text-error", tag: "High Priority Action" },
  MEDIUM: { border: "border-l-warning", iconColor: "text-warning", tag: "Advisory" },
  LOW: { border: "border-l-success", iconColor: "text-success", tag: "Best Practice" },
};

export default function RecommendationCard({ message, priority }: RecommendationCardProps) {
  const Icon = severityIcon[priority];
  const styles = severityStyles[priority];

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3.5 rounded-xl border border-border border-l-4 bg-card p-4 shadow-2xs transition-colors hover:bg-muted/20",
        styles.border
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", styles.iconColor)} />
        <p className="text-xs sm:text-sm font-medium text-foreground leading-relaxed">{message}</p>
      </div>
      <Badge variant={priorityTone(priority)} className="shrink-0 text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5">
        {styles.tag}
      </Badge>
    </div>
  );
}
