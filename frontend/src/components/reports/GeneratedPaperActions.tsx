import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download, FileDown, FilePlus2, Loader2 } from "lucide-react";
import { reportService } from "../../services/reportService";
import { apiErrorMessage } from "../../services/api";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { UploadDuplicateWarning } from "../../types";

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Get the generated paper out of AcadIQ: student-facing PDF, Markdown, or adopt it into the course bank. */
export default function GeneratedPaperActions({ reportId, courseId }: { reportId: number; courseId: number }) {
  const queryClient = useQueryClient();
  const [annotations, setAnnotations] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "md" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [semester, setSemester] = useState("Spring");
  const [adopted, setAdopted] = useState<{ id: number; warnings: UploadDuplicateWarning[] } | null>(null);

  async function download(format: "pdf" | "md") {
    setBusy(format);
    setError(null);
    try {
      const { blob, filename } = await reportService.downloadGeneratedPaper(reportId, format, annotations);
      saveBlob(blob, filename);
    } catch (e) {
      setError(apiErrorMessage(e, "Download failed"));
    } finally {
      setBusy(null);
    }
  }

  const adopt = useMutation({
    mutationFn: () => reportService.adoptGeneratedPaper(reportId, { year, semester, includeAnnotations: annotations }),
    onSuccess: (paper) => {
      setAdopted({ id: paper.id, warnings: paper.duplicateWarnings ?? [] });
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["courses"] });
      void queryClient.invalidateQueries({ queryKey: ["course", courseId] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Could not add the paper to the course")),
  });

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={() => download("pdf")} disabled={busy !== null}>
          {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download question paper (PDF)
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => download("md")} disabled={busy !== null}>
          {busy === "md" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Markdown
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={adopted !== null}>
              <FilePlus2 className="h-4 w-4" /> {adopted ? "Added to course" : "Add to course as a paper"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add this generated paper to the course</DialogTitle>
              <DialogDescription>
                Creates a real question paper (PDF + parsed questions with their Bloom/topic labels) so you can run the analysers on it, collect feedback and compare it against future drafts.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input type="number" min={1900} max={new Date().getFullYear() + 2} value={year} onChange={(e) => setYear(Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Semester</Label>
                <select className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={semester} onChange={(e) => setSemester(e.target.value)}>
                  {["Spring", "Summer", "Fall", "Winter", "Semester 1", "Semester 2", "Semester 3"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <Button className="mt-2 gap-1.5" onClick={() => adopt.mutate()} disabled={adopt.isPending}>
              {adopt.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />} Create paper
            </Button>
          </DialogContent>
        </Dialog>
        <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={annotations} onChange={(e) => setAnnotations(e.target.checked)} />
          Include Bloom/CO annotations (faculty copy)
        </label>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      {adopted && (
        <p className="text-xs text-muted-foreground">
          Paper #{adopted.id} created in this course
          {adopted.warnings.length ? ` — ${adopted.warnings.length} question(s) near-duplicate the existing bank` : ""}.{" "}
          <Link to={`/courses/${courseId}`} className="text-primary underline-offset-2 hover:underline">Open course</Link>
        </p>
      )}
    </div>
  );
}
