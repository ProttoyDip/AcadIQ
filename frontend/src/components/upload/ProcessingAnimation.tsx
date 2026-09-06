import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import { cn } from "../../lib/utils";

const STEPS = [
  "Extracting text from documents",
  "Mapping questions to syllabus topics",
  "Scoring Bloom's taxonomy distribution",
  "Checking similarity against past papers",
  "Generating AI recommendations",
];

/** Purely visual step sequencer — advances on a timer while the real request is in flight. */
export default function ProcessingAnimation({ active }: { active: boolean }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 900);
    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
        <p className="text-small font-semibold text-foreground">AcadIQ AI is analyzing your documents</p>
      </div>
      {STEPS.map((step, i) => {
        const done = i < stepIndex;
        const current = i === stepIndex;
        return (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-2.5"
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
            ) : current ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary-600" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            )}
            <span className={cn("text-small", done || current ? "text-foreground" : "text-muted-foreground/60")}>
              {step}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
