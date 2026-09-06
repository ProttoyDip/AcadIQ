import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

interface ScoreHeroProps {
  score: number;
  title: string;
  subtitle: string;
}

function scoreLabel(score: number) {
  if (score >= 85) return "Excellent quality";
  if (score >= 70) return "Good, minor gaps";
  if (score >= 50) return "Needs improvement";
  return "Significant revision needed";
}

export default function ScoreHero({ score, title, subtitle }: ScoreHeroProps) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const tone = score >= 75 ? "#1a7f4b" : score >= 50 ? "#b7791f" : "#c22a2a";

  return (
    <div className="flex flex-col items-center gap-6 rounded-lg border border-border bg-card p-8 shadow-card sm:flex-row sm:justify-between">
      <div>
        <p className="text-small font-medium uppercase tracking-wide text-muted-foreground">{subtitle}</p>
        <h2 className="mt-1 text-heading font-bold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 text-body" style={{ color: tone }}>
          {scoreLabel(score)}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative flex h-32 w-32 shrink-0 items-center justify-center"
      >
        <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={tone}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className={cn("absolute flex flex-col items-center")}>
          <span className="text-heading font-bold text-foreground">{Math.round(score)}</span>
          <span className="text-xs text-muted-foreground">out of 100</span>
        </div>
      </motion.div>
    </div>
  );
}
