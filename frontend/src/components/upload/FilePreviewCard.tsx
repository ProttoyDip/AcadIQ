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
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2.5"
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50">
          <FileText className="h-4 w-4 text-primary-700" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-small font-medium text-foreground">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
        </div>
      </div>
      {status === "uploaded" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
      ) : (
        onRemove && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onRemove}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )
      )}
    </motion.div>
  );
}
