import { FileText, X, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../ui/button";

interface FilePreviewCardProps {
  file: File;
  status?: "ready" | "uploaded";
  onRemove?: () => void;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilePreviewCard({ file, status = "ready", onRemove }: FilePreviewCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 shadow-2xs">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/60 border border-primary-100 dark:border-primary-900 text-primary-700 dark:text-primary-300">
          <FileText className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs sm:text-sm font-semibold text-foreground tracking-tight">{file.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground tabular-nums">{formatBytes(file.size)}</span>
            {status === "uploaded" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success">
                <CheckCircle2 className="h-3 w-3" /> Indexed
              </span>
            )}
          </div>
        </div>
      </div>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-error hover:bg-error-bg/50 transition-colors"
          onClick={onRemove}
          title="Remove or replace document"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
