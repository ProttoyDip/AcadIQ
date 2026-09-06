import { FileText } from "lucide-react";

export default function SourceReferenceCard({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs font-medium text-muted-foreground">
      <FileText className="h-3 w-3 text-primary-600" />
      {label}
    </span>
  );
}
