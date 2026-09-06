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

const levelStyles: Record<RiskLevel, { badge: string; border: string; icon: string }> = {
  HIGH: { badge: "bg-error-bg text-error border-error-border", border: "border-l-error", icon: "text-error" },
  MEDIUM: { badge: "bg-warning-bg text-warning border-warning-border", border: "border-l-warning", icon: "text-warning" },
  LOW: { badge: "bg-success-bg text-success border-success-border", border: "border-l-success", icon: "text-success" },
};

export default function RiskCard({ level, icon: Icon, category, finding, active, index = 0 }: RiskCardProps) {
  const styles = levelStyles[level];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-l-4 border-border bg-card p-4",
        active ? styles.border : "border-l-border"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", styles.badge)}>
          {level === "HIGH" ? "High Risk" : level === "MEDIUM" ? "Medium Risk" : "Low Risk"}
        </span>
        <Icon className={cn("h-4 w-4", active ? styles.icon : "text-muted-foreground/40")} />
      </div>
      <div>
        <p className="text-small font-semibold text-foreground">{category}</p>
        <p className="mt-1 text-small text-muted-foreground">{finding}</p>
      </div>
    </motion.div>
  );
}
