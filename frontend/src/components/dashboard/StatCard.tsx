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

export default function StatCard({ label, value, icon: Icon, trend, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-small font-medium text-muted-foreground">{label}</p>
              <p className="mt-2 text-heading font-bold tracking-tight text-foreground">{value}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
              <Icon className="h-5 w-5 text-primary-700" strokeWidth={1.75} />
            </div>
          </div>
          {trend && (
            <div
              className={cn(
                "mt-3 inline-flex items-center gap-1 text-xs font-medium",
                trend.positive === false ? "text-error" : "text-success"
              )}
            >
              {trend.direction === "up" ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              <span>{trend.value}</span>
              <span className="font-normal text-muted-foreground">vs last semester</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
