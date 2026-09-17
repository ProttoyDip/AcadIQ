import { FormEvent, useState } from "react";
import { CheckCircle2, FileText, Plus, Sparkles } from "lucide-react";
import { useCourse, useCourses, useCreateCourse } from "../hooks/useCourses";
import { useUploadSyllabus, useUploadQuestionPaper } from "../hooks/useUpload";
import { apiErrorMessage } from "../services/api";
import PageHeader from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import Dropzone from "../components/upload/Dropzone";
import FilePreviewCard from "../components/upload/FilePreviewCard";
import ProcessingAnimation from "../components/upload/ProcessingAnimation";
import AnalysisActions from "../components/analysis/AnalysisActions";
import TeachingMaterialsPanel from "../components/upload/TeachingMaterialsPanel";
import { UploadDuplicateWarning } from "../types";
import { cn } from "../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "../components/ui/dialog";

export default function UploadAnalysis() {
  const { data: courses } = useCourses();
  const createCourse = useCreateCourse();
  const uploadSyllabus = useUploadSyllabus();
  const uploadQuestionPaper = useUploadQuestionPaper();

  const [courseId, setCourseId] = useState<string>("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [semester, setSemester] = useState("Spring");
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [syllabusUploaded, setSyllabusUploaded] = useState(false);
  const [questionPaperId, setQuestionPaperId] = useState<number | null>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<UploadDuplicateWarning[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [newCourseForm, setNewCourseForm] = useState({ courseCode: "", courseName: "", description: "" });
  const [newCourseError, setNewCourseError] = useState<string | null>(null);

  const [replacingSyllabus, setReplacingSyllabus] = useState(false);

  const { data: course } = useCourse(courseId ? Number(courseId) : null);
  // Sorted explicitly: the course detail returns syllabi unordered, but every analysis
  // reads the newest one (documentRepository.findLatestSyllabus), so show that same one.
  const existingSyllabus =
    [...(course?.syllabusDocuments ?? [])].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0] ?? null;
  // A syllabus already stored on the course satisfies this step. The backend never needed
  // a fresh copy, and re-uploading only inserts a duplicate row that shadows the old one.
  const hasSyllabus = syllabusUploaded || (!!existingSyllabus && !replacingSyllabus);

  const canUpload = !!courseId;

  function handleCourseChange(next: string) {
    // Staging is per course; carrying it across a switch would claim documents
    // that were uploaded against the previous course.
    setCourseId(next);
    setSyllabusFile(null);
    setSyllabusUploaded(false);
    setPaperFile(null);
    setQuestionPaperId(null);
    setDuplicateWarnings([]);
    setReplacingSyllabus(false);
    setError(null);
  }

  async function handleCreateCourse(e: FormEvent) {
    e.preventDefault();
    setNewCourseError(null);
    try {
      const created = await createCourse.mutateAsync(newCourseForm);
      setCourseId(String(created.id));
      setNewCourseForm({ courseCode: "", courseName: "", description: "" });
      setCourseDialogOpen(false);
    } catch (err) {
      setNewCourseError(apiErrorMessage(err, "Could not create course"));
    }
  }

  async function handleSyllabusFile(file: File) {
    setSyllabusFile(file);
    setError(null);
    try {
      await uploadSyllabus.mutateAsync({ courseId: Number(courseId), file });
      setSyllabusUploaded(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Syllabus upload failed"));
    }
  }

  async function handlePaperFile(file: File) {
    setPaperFile(file);
    setError(null);
    try {
      const paper = await uploadQuestionPaper.mutateAsync({ courseId: Number(courseId), year, semester, file });
      setQuestionPaperId(paper.id);
      setDuplicateWarnings(paper.duplicateWarnings ?? []);
    } catch (err) {
      setError(apiErrorMessage(err, "Question paper upload failed"));
    }
  }

  const readyToAnalyze = hasSyllabus && !!questionPaperId;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <PageHeader
        title="Pre-Exam Audit Ingestion"
        description="Ingest course syllabi and draft question papers to trigger the AI Exam Quality Analyzer."
      />

      {/* Step 1 */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <span className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
              canUpload ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              1
            </span>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">Academic Scope & Term Context</CardTitle>
              <p className="text-xs text-muted-foreground">Select the target course catalog item and assessment term</p>
            </div>
          </div>
          <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <Plus className="h-3.5 w-3.5" /> Add Course Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Course Code</DialogTitle>
                <DialogDescription>
                  Register a university catalog course code to associate assessment papers and syllabi.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCourse} className="flex flex-col gap-4">
                {newCourseError && (
                  <div className="rounded-lg border border-error-border bg-error-bg/60 px-3 py-2 text-xs text-error font-medium">
                    {newCourseError}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="newCourseCode" className="text-xs font-semibold">Course Code</Label>
                  <Input
                    id="newCourseCode"
                    placeholder="e.g. CSE 3811"
                    required
                    value={newCourseForm.courseCode}
                    onChange={(e) => setNewCourseForm({ ...newCourseForm, courseCode: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="newCourseName" className="text-xs font-semibold">Course Title</Label>
                  <Input
                    id="newCourseName"
                    placeholder="e.g. Artificial Intelligence & Heuristics"
                    required
                    value={newCourseForm.courseName}
                    onChange={(e) => setNewCourseForm({ ...newCourseForm, courseName: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="newCourseDescription" className="text-xs font-semibold">Description (optional)</Label>
                  <Input
                    id="newCourseDescription"
                    placeholder="Department or degree program"
                    value={newCourseForm.description}
                    onChange={(e) => setNewCourseForm({ ...newCourseForm, description: e.target.value })}
                  />
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" size="sm">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" size="sm" disabled={createCourse.isPending}>
                    {createCourse.isPending ? "Registering..." : "Register Course"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">Course Catalog Item</Label>
            <Select value={courseId} onValueChange={handleCourseChange}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={courses?.length === 0 ? "No courses - Add one first" : "Select course..."} />
              </SelectTrigger>
              <SelectContent>
                {courses && courses.length > 0 ? (
                  courses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)} className="text-xs">
                      {c.courseCode} — {c.courseName}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-center text-xs text-muted-foreground">
                    No registered courses. Click "+ Add Course Code" above.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">Academic Year</Label>
            <Input type="number" className="h-9 text-xs" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">Academic Term</Label>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Spring" className="text-xs">Spring Term</SelectItem>
                <SelectItem value="Summer" className="text-xs">Summer Term</SelectItem>
                <SelectItem value="Fall" className="text-xs">Fall Term</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Step 2 */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <span className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
              readyToAnalyze ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              2
            </span>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">Document Ingestion</CardTitle>
              <p className="text-xs text-muted-foreground">Upload the official syllabus and examination paper in PDF or DOCX format</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {hasSyllabus && questionPaperId ? (
              <span className="text-success font-bold">2/2 Documents Staged</span>
            ) : hasSyllabus || questionPaperId ? (
              <span className="text-warning font-bold">1/2 Documents Staged</span>
            ) : (
              "0/2 Staged"
            )}
          </span>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-2.5">
            <Label className="text-xs font-semibold text-foreground">Course Syllabus Reference (PDF or DOCX)</Label>
            {syllabusFile ? (
              <FilePreviewCard
                file={syllabusFile}
                status={syllabusUploaded ? "uploaded" : "ready"}
                onRemove={() => {
                  setSyllabusFile(null);
                  setSyllabusUploaded(false);
                }}
              />
            ) : existingSyllabus && !replacingSyllabus ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3.5 shadow-2xs">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-700 dark:border-primary-900 dark:bg-primary-950/60 dark:text-primary-300">
                    <FileText className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold tracking-tight text-foreground sm:text-sm">{existingSyllabus.originalName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        Already on this course · {new Date(existingSyllabus.uploadedAt).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success">
                        <CheckCircle2 className="h-3 w-3" /> Indexed
                      </span>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={() => setReplacingSyllabus(true)}>
                  Replace
                </Button>
              </div>
            ) : (
              <>
                <Dropzone label="Official Course Syllabus" onFileAccepted={handleSyllabusFile} disabled={!canUpload} />
                {existingSyllabus && replacingSyllabus && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 self-start text-xs"
                    onClick={() => setReplacingSyllabus(false)}
                  >
                    Keep existing syllabus
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            <Label className="text-xs font-semibold text-foreground">Draft Question Paper (PDF or DOCX)</Label>
            {paperFile ? (
              <FilePreviewCard
                file={paperFile}
                status={questionPaperId ? "uploaded" : "ready"}
                onRemove={() => {
                  setPaperFile(null);
                  setQuestionPaperId(null);
                  setDuplicateWarnings([]);
                }}
              />
            ) : (
              <Dropzone label="Draft Examination Paper" onFileAccepted={handlePaperFile} disabled={!canUpload} />
            )}
            {duplicateWarnings.length > 0 && (
              <div className="rounded-lg border border-warning-border bg-warning-bg/60 p-3 text-xs text-warning">
                <p className="font-semibold">
                  {duplicateWarnings.length} question{duplicateWarnings.length === 1 ? "" : "s"} near-duplicate earlier papers in this course (embedding cosine ≥ 0.90):
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {duplicateWarnings.map((w) => (
                    <li key={w.questionId} className="tabular-nums">
                      Q{w.sequenceNumber} ≈ {w.matches.map((m) => `Q${m.sequenceNumber} (${m.semester} ${m.year}, ${m.cosine.toFixed(2)})`).join(", ")}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] opacity-80">Model-free check at upload time; run Question Similarity for the AI explanation.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Optional: what was actually taught */}
      <Card className="shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">+</span>
            <div>
              <CardTitle className="text-sm font-bold tracking-tight">Teaching Materials <span className="font-normal text-muted-foreground">(optional, recommended)</span></CardTitle>
              <p className="text-xs text-muted-foreground">
                Lecture slides, notes and handouts. The Copilot cites them by slide, and the paper generator writes questions at the depth you actually taught.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <TeachingMaterialsPanel courseId={courseId ? Number(courseId) : null} compact />
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-xl border border-error-border bg-error-bg/60 p-4 text-xs font-medium text-error flex items-start gap-2.5">
          <span className="font-bold">Audit Error:</span> {error}
        </div>
      )}

      {/* Step 3 */}
      <Card className="shadow-xs border-primary-200 dark:border-primary-800/80 bg-gradient-to-r from-card via-card to-primary-50/30 dark:to-primary-950/20">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-950/60 border border-primary-100 dark:border-primary-800 text-primary-700 dark:text-primary-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground tracking-tight">3. Initiate Quality Assurance Pipeline</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The full audit runs Exam Quality, Syllabus Coverage, Question Review, CO Mapping and — when an earlier
                paper exists — Question Similarity, then opens the main report.
              </p>
            </div>
          </div>
          {processing && <ProcessingAnimation active={processing} />}
          {questionPaperId ? (
            <AnalysisActions
              courseId={Number(courseId)}
              questionPaperId={questionPaperId}
              disabled={!readyToAnalyze}
              navigateOnComplete
              onStart={() => setProcessing(true)}
              onFinish={() => setProcessing(false)}
            />
          ) : (
            <p className="text-xs font-medium text-muted-foreground">
              {hasSyllabus
                ? "Upload the draft question paper above to enable analysis."
                : "Upload both documents above to enable analysis."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
