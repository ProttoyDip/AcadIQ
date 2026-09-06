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
  const displayName = name ? `Dr. ${name.split(" ").pop()}` : "there";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"
    >
      <div>
        <h1 className="text-heading font-bold tracking-tight text-foreground">
          {getGreeting()}, {displayName}
        </h1>
        <p className="mt-1.5 text-body text-muted-foreground">Your academic quality overview, at a glance.</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 text-small text-muted-foreground">
        <CalendarDays className="h-4 w-4" />
        <span>{today}</span>
      </div>
    </motion.div>
  );
}
