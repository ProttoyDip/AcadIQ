import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { cn } from "../../lib/utils";

interface DropzoneProps {
  label: string;
  hint?: string;
  onFileAccepted: (file: File) => void;
  disabled?: boolean;
}

export default function Dropzone({ label, hint, onFileAccepted, disabled }: DropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFileAccepted(accepted[0]);
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-9 text-center transition-all",
        isDragActive && "border-primary-500 bg-primary-50/50 dark:bg-primary-950/40 scale-[0.99]",
        disabled ? "cursor-not-allowed opacity-50 bg-muted/10" : "hover:border-primary-300 dark:hover:border-primary-700 hover:bg-muted/40"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950/60 border border-primary-100 dark:border-primary-800 text-primary-700 dark:text-primary-300 shadow-2xs">
        <UploadCloud className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs sm:text-sm font-semibold text-foreground tracking-tight">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint ?? "Drag & drop PDF or DOCX here, or browse files"}</p>
      </div>
      <span className="inline-flex items-center rounded border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        PDF or DOCX documents (max 10 MB)
      </span>
    </div>
  );
}
