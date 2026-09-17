import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Trash2, UploadCloud } from "lucide-react";
import { scheduleService } from "../services/scheduleService";
import { apiErrorMessage } from "../services/api";
import PageHeader from "../components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { DAY_SHORT, fmtTime } from "../lib/dates";
import { cn } from "../lib/utils";
import { formatDate } from "../lib/format";

/** Admin: one department-wide routine powers free-room lookup and section clash checks for every faculty. */
export default function AdminDepartmentRoutine() {
  const queryClient = useQueryClient();
  const [termLabel, setTermLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ slotCount: number; rooms: number; teachers: number; warnings: string[] } | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const routines = useQuery({ queryKey: ["admin", "department-routine"], queryFn: scheduleService.listDepartmentRoutines });
  const slots = useQuery({ queryKey: ["admin", "department-routine", openId], queryFn: () => scheduleService.departmentSlots(openId!), enabled: openId !== null });

  const upload = useMutation({
    mutationFn: (file: File) => scheduleService.importDepartmentRoutine(file, termLabel.trim() || "Current term", true),
    onSuccess: (r) => {
      setResult({ slotCount: r.slotCount, rooms: r.rooms, teachers: r.teachers, warnings: r.warnings });
      setError(null);
      setOpenId(r.id);
      void queryClient.invalidateQueries({ queryKey: ["admin", "department-routine"] });
    },
    onError: (e) => setError(apiErrorMessage(e, "Import failed")),
  });
  const remove = useMutation({
    mutationFn: (id: number) => scheduleService.deleteDepartmentRoutine(id),
    onSuccess: () => {
      setOpenId(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "department-routine"] });
    },
  });
  const onDrop = useCallback((files: File[]) => files[0] && upload.mutate(files[0]), [upload]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, disabled: upload.isPending, accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "text/plain": [".txt", ".csv"], "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] } });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Department routine" description="Upload the full department timetable once. Faculty then get free-room suggestions and section-clash checks when they reschedule." />

      <Card className="shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold tracking-tight"><Building2 className="h-4 w-4 text-primary" /> Import routine</CardTitle>
          <CardDescription className="text-xs">AI reads every row (course, section, teacher, day, time, room). Replaces the previous routine.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-end">
            <div {...getRootProps()} className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors", isDragActive ? "border-primary bg-primary-50/60" : "border-border hover:border-primary-200 hover:bg-muted/40", upload.isPending && "pointer-events-none opacity-60")}>
              <input {...getInputProps()} />
              {upload.isPending ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <UploadCloud className="h-6 w-6 text-muted-foreground" />}
              <p className="text-small font-semibold text-foreground">{upload.isPending ? "Reading the routine… (large files take a minute)" : "Drop the department routine (PDF / DOCX / TXT or a photo)"}</p>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="term-label" className="text-xs">Term label</Label>
              <Input id="term-label" value={termLabel} onChange={(e) => setTermLabel(e.target.value)} placeholder="Fall 2026" className="h-9" />
            </div>
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
          {result && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="success">{result.slotCount} slots</Badge>
              <Badge variant="brand">{result.rooms} rooms</Badge>
              <Badge variant="brand">{result.teachers} teachers</Badge>
              {result.warnings.map((w, i) => <span key={i} className="text-warning">{w}</span>)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader className="pb-3"><CardTitle className="text-base font-bold tracking-tight">Uploaded routines</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(routines.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nothing uploaded yet.</p>}
          <ul className="divide-y divide-border rounded-lg border border-border">
            {(routines.data ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                  <span className="font-semibold text-foreground">{r.termLabel}</span> · {r.originalName} · {r.slotCount} slots · {formatDate(r.createdAt)}{r.uploadedBy ? ` · ${r.uploadedBy.name}` : ""}
                </button>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(r.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
          {openId !== null && slots.data && (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Day</TableHead><TableHead>Time</TableHead><TableHead>Course</TableHead><TableHead>Sec</TableHead><TableHead>Teacher</TableHead><TableHead>Room</TableHead><TableHead>Kind</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {slots.data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{DAY_SHORT[s.dayOfWeek]}</TableCell>
                    <TableCell>{fmtTime(s.startTime)}–{fmtTime(s.endTime)}</TableCell>
                    <TableCell className="font-medium">{s.courseLabel}</TableCell>
                    <TableCell>{s.section ?? "—"}</TableCell>
                    <TableCell>{s.teacher ?? "—"}</TableCell>
                    <TableCell>{s.room ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{s.kind.toLowerCase()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
