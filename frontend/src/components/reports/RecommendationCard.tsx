import { motion } from "framer-motion";
import { AlertTriangle, AlertCircle, Info, Sparkles } from "lucide-react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import { priorityTone } from "../../lib/format";
import { Priority } from "../../types";

interface RecommendationCardProps {
  issue: string;
  priority: Priority;
  recommendation: string;
  index?: number;
}

const severityIcon: Record<Priority, typeof AlertTriangle> = {
  HIGH: AlertTriangle,
  MEDIUM: AlertCircle,
  LOW: Info,
};

const severityBorder: Record<Priority, string> = {
  HIGH: "border-l-error",
  MEDIUM: "border-l-warning",
  LOW: "border-l-success",
};

/**
 * Splits a stored recommendation message into an "issue" line and the actionable
 * suggestion — the AI prompt writes plain sentences, so this renders best-effort.
 */
export function splitRecommendation(message: string): { issue: string; recommendation: string } {
  const parts = message.split(/[.;]\s+/);
  if (parts.length >= 2) {
    return { issue: parts[0], recommendation: parts.slice(1).join(". ") };
  }
  return { issue: message, recommendation: "" };
}

export default function RecommendationCard({ issue, priority, recommendation, index = 0 }: RecommendationCardProps) {
  const Icon = severityIcon[priority];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={cn("flex flex-col gap-3 rounded-lg border border-l-4 border-border bg-card p-4", severityBorder[priority])}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issue</p>
            <p className="text-small font-medium text-foreground">{issue}</p>
          </div>
        </div>
        <Badge variant={priorityTone(priority)}>{priority}</Badge>
      </div>

      {recommendation && (
        <div className="flex items-start gap-2.5 rounded-md bg-primary-50/60 p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" />
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-primary-700">Recommendation</p>
            <p className="text-small text-foreground">{recommendation}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
