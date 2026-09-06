import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

export default function WelcomeHeader({ name }: { name?: string }) {
  const displayName = name ? (name.startsWith("Dr.") ? name : `Dr. ${name.split(" ").pop()}`) : "Faculty Member";

  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-border/60 pb-5">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {displayName}
          </h1>
          <span className="hidden md:inline-flex items-center rounded-md border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-950/60 px-2 py-0.5 text-xs font-semibold text-primary-800 dark:text-primary-300">
            Faculty QA
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Pre-publishing academic quality oversight, cognitive distribution, and outcome alignment.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground rounded-lg border border-border bg-card px-3 py-1.5 shadow-2xs">
        <CalendarDays className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" />
        <span>{today}</span>
      </div>
    </div>
  );
}
