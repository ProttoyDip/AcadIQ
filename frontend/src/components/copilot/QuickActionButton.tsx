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
        "flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-small font-medium text-foreground transition-colors hover:border-primary-200 hover:bg-primary-50/60 disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary-700" />
      {label}
    </button>
  );
}
