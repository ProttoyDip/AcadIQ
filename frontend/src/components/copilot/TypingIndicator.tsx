import { motion } from "framer-motion";

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary-400"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">AcadIQ Copilot is checking the academic record...</span>
    </div>
  );
}
