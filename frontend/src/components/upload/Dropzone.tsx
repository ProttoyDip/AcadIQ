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
    accept: { "application/pdf": [".pdf"] },
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-6 py-10 text-center transition-colors",
        isDragActive && "border-primary-500 bg-primary-50",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100">
        <UploadCloud className="h-5 w-5 text-primary-700" />
      </div>
      <p className="text-small font-semibold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{hint ?? "Drag & drop a PDF, or click to browse"}</p>
    </div>
  );
}
