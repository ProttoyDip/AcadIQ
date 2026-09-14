import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Presentation, FileText, Trash2, Loader2, UploadCloud, BookOpen } from "lucide-react";
import { uploadService } from "../../services/uploadService";
import { apiErrorMessage } from "../../services/api";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { TeachingMaterial } from "../../types";

const KIND_LABEL: Record<TeachingMaterial["kind"], string> = { SLIDES: "Slides", NOTES: "Lecture notes", HANDOUT: "Handout", OTHER: "Material" };

function kindIcon(kind: TeachingMaterial["kind"]) {
  return kind === "SLIDES" ? Presentation : kind === "NOTES" ? BookOpen : FileText;
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * What was actually taught. Slides/notes are chunked and embedded so the Copilot
 * cites them and the paper generator writes questions at the depth the class saw.
 */
export default function TeachingMaterialsPanel({
  courseId,
  compact = false,
  selectable,
}: {
  courseId: number | null;
  compact?: boolean;
  /** When provided, each material gets a checkbox; newly uploaded files are auto-selected. */
  selectable?: { selectedIds: number[]; onChange: (ids: number[]) => void };
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ added: number; failures: Array<{ file: string; error: string }> } | null>(null);
  const { data: materials, isLoading } = useQuery({
    queryKey: ["materials", courseId],
    queryFn: () => uploadService.listTeachingMaterials(courseId!),
    enabled: Boolean(courseId),
  });

  const upload = useMutation({
    mutationFn: (files: File[]) => uploadService.uploadTeachingMaterials(courseId!, files),
    onSuccess: (r) => {
      setLastResult({ added: r.materials.length, failures: r.failures });
      setError(null);
      if (selectable) selectable.onChange([...selectable.selectedIds, ...r.materials.map((m) => m.id)]);
      void queryClient.invalidateQueries({ queryKey: ["materials", courseId] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Upload failed")),
  });
  const remove = useMutation({
    mutationFn: (materialId: number) => uploadService.deleteTeachingMaterial(courseId!, materialId),
    onSuccess: (_r, materialId) => {
      if (selectable) selectable.onChange(selectable.selectedIds.filter((id) => id !== materialId));
      void queryClient.invalidateQueries({ queryKey: ["materials", courseId] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not remove material")),
  });

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length && courseId) upload.mutate(accepted);
    },
    [courseId, upload]
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    disabled: !courseId || upload.isPending,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "text/plain": [".txt"],
      "text/markdown": [".md"],
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <div
        {...getRootProps()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 text-center transition-colors",
          compact ? "py-5" : "py-8",
          isDragActive ? "border-primary bg-primary-50/60 dark:bg-primary-950/40" : "border-border hover:border-primary-300",
          (!courseId || upload.isPending) && "cursor-not-allowed opacity-60"
        )}
      >
        <input {...getInputProps()} />
        {upload.isPending ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <UploadCloud className="h-6 w-6 text-primary" />}
        <p className="text-small font-semibold text-foreground">
          {upload.isPending ? "Extracting and indexing…" : "Drop lecture slides, notes or handouts"}
        </p>
        <p className="text-xs text-muted-foreground">PPTX, PDF, DOCX, TXT, MD · up to 10 files · 40 MB each · slide numbers are kept for citations</p>
      </div>

      {error && <p className="text-xs text-error">{error}</p>}
      {lastResult && (
        <p className="text-xs text-muted-foreground">
          Added {lastResult.added} file{lastResult.added === 1 ? "" : "s"}.
          {lastResult.failures.length > 0 && ` Skipped: ${lastResult.failures.map((f) => `${f.file} (${f.error})`).join("; ")}`}
        </p>
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Loading materials…</p>}
      {materials && materials.length === 0 && (
        <p className="text-xs text-muted-foreground">No teaching materials yet. Analyses and the paper generator will use the syllabus alone.</p>
      )}
      {materials && materials.length > 0 && (
        <ul className="divide-y divide-border/60 rounded-lg border border-border">
          {materials.map((m) => {
            const Icon = kindIcon(m.kind);
            const checked = selectable ? selectable.selectedIds.includes(m.id) : false;
            return (
              <li key={m.id} className={cn("flex items-center gap-3 px-3 py-2 text-small", selectable && !checked && "opacity-60")}>
                {selectable && (
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-primary"
                    aria-label={`Use ${m.title} for generation`}
                    checked={checked}
                    onChange={(e) =>
                      selectable.onChange(e.target.checked ? [...selectable.selectedIds, m.id] : selectable.selectedIds.filter((id) => id !== m.id))
                    }
                  />
                )}
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{m.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {m.originalName} · {formatBytes(m.fileSize)} · {m.chunkCount} passage{m.chunkCount === 1 ? "" : "s"} indexed
                  </p>
                </div>
                <Badge variant="muted" className="shrink-0">{KIND_LABEL[m.kind]}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-error"
                  title="Remove material"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(m.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
