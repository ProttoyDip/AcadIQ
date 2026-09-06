import { useRef, useState } from "react";

interface UploadBoxProps {
  label: string;
  onFileSelected: (file: File) => void;
  accept?: string;
}

export default function UploadBox({ label, onFileSelected, accept = "application/pdf" }: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-center hover:border-brand-500"
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setFileName(file.name);
            onFileSelected(file);
          }
        }}
      />
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{fileName ?? "Click to select a PDF file"}</p>
    </div>
  );
}
