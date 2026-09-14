import { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export default function QuickActionButton({ icon: Icon, label, onClick, disabled }: QuickActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-primary-50 dark:hover:border-primary-700 dark:hover:bg-primary-950/50 disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
      {label}
    </button>
  );
}
