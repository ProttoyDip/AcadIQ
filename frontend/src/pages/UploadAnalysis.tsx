import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useCourses } from "../hooks/useCourses";
import { useUploadSyllabus, useUploadQuestionPaper } from "../hooks/useUpload";
import { useAnalyzeExam } from "../hooks/useAnalysis";
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

export default function UploadAnalysis() {
  const { data: courses } = useCourses();
  const uploadSyllabus = useUploadSyllabus();
  const uploadQuestionPaper = useUploadQuestionPaper();
  const analyzeExam = useAnalyzeExam();
  const navigate = useNavigate();

  const [courseId, setCourseId] = useState<string>("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [semester, setSemester] = useState("Spring");
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [syllabusUploaded, setSyllabusUploaded] = useState(false);
  const [questionPaperId, setQuestionPaperId] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUpload = !!courseId;

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
    } catch (err) {
      setError(apiErrorMessage(err, "Question paper upload failed"));
    }
  }

  async function runAnalysis() {
    if (!questionPaperId) return;
    setError(null);
    setProcessing(true);
    try {
      const result = await analyzeExam.mutateAsync({ courseId: Number(courseId), questionPaperId });
      navigate(`/reports/${result.reportId}`);
    } catch (err) {
      setError(apiErrorMessage(err, "AI analysis failed"));
    } finally {
      setProcessing(false);
    }
  }

  const readyToAnalyze = syllabusUploaded && !!questionPaperId;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Upload & analyze"
        description="Upload a syllabus and question paper to run the AI Exam Quality Analyzer."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold">1. Select course & paper details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a course" />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.courseCode} — {c.courseName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Year</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Semester</Label>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Spring">Spring</SelectItem>
                <SelectItem value="Summer">Summer</SelectItem>
                <SelectItem value="Fall">Fall</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold">2. Upload documents</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            {syllabusFile ? (
              <FilePreviewCard
                file={syllabusFile}
                status={syllabusUploaded ? "uploaded" : "ready"}
                onRemove={() => {
                  setSyllabusFile(null);
                  setSyllabusUploaded(false);
                }}
              />
            ) : (
              <Dropzone label="Syllabus (PDF)" onFileAccepted={handleSyllabusFile} disabled={!canUpload} />
            )}
          </div>
          <div className="flex flex-col gap-3">
            {paperFile ? (
              <FilePreviewCard
                file={paperFile}
                status={questionPaperId ? "uploaded" : "ready"}
                onRemove={() => {
                  setPaperFile(null);
                  setQuestionPaperId(null);
                }}
              />
            ) : (
              <Dropzone label="Question paper (PDF)" onFileAccepted={handlePaperFile} disabled={!canUpload} />
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-small text-error">{error}</div>
      )}

      {processing ? (
        <ProcessingAnimation active={processing} />
      ) : (
        <Card>
          <CardContent className="flex items-center justify-between pt-5">
            <div>
              <p className="text-small font-semibold text-foreground">3. Run AI Exam Quality Analysis</p>
              <p className="text-xs text-muted-foreground">
                Requires an uploaded syllabus and question paper for this course.
              </p>
            </div>
            <Button onClick={runAnalysis} disabled={!readyToAnalyze || analyzeExam.isPending}>
              <Sparkles className="h-4 w-4" />
              {analyzeExam.isPending ? "Analyzing..." : "Run analysis"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
