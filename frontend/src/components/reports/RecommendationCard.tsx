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

const severityBorder: Record<Priority, string> = {
  HIGH: "border-l-error",
  MEDIUM: "border-l-warning",
  LOW: "border-l-success",
};

export default function RecommendationCard({ message, priority, index = 0 }: RecommendationCardProps) {
  const Icon = severityIcon[priority];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-l-4 border-border bg-card p-4",
        severityBorder[priority]
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <p className="flex-1 text-small text-foreground">{message}</p>
      <Badge variant={priorityTone(priority)}>{priority}</Badge>
    </motion.div>
  );
}
