import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSearch2, GitCompareArrows } from "lucide-react";
import { useCourses, useCourse } from "../hooks/useCourses";
import { useAnalyzeSimilarity } from "../hooks/useAnalysis";
import { apiErrorMessage } from "../services/api";
import PageHeader from "../components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { EmptyState } from "../components/ui/empty-state";
import { LoadingState } from "../components/ui/loading-state";

export default function QuestionMemory() {
  const { data: courses } = useCourses();
  const [courseId, setCourseId] = useState<string>("");
  const { data: course, isLoading: courseLoading } = useCourse(courseId ? Number(courseId) : null);
  const [currentPaperId, setCurrentPaperId] = useState<string>("");
  const [previousPaperId, setPreviousPaperId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const analyzeSimilarity = useAnalyzeSimilarity();
  const navigate = useNavigate();

  const papers = course?.questionPapers ?? [];
  const selectedPaper = papers.find((p) => String(p.id) === currentPaperId);

  async function runSimilarityCheck() {
    if (!courseId || !currentPaperId || !previousPaperId) return;
    setError(null);
    try {
      const result = await analyzeSimilarity.mutateAsync({
        courseId: Number(courseId),
        currentPaperId: Number(currentPaperId),
        previousPaperId: Number(previousPaperId),
      });
      navigate(`/reports/${result.reportId}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Similarity check failed"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Question memory"
        description="Browse past question papers and detect duplicates before finalizing a new exam."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold">Compare against a previous paper</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>Course</Label>
              <Select
                value={courseId}
                onValueChange={(v) => {
                  setCourseId(v);
                  setCurrentPaperId("");
                  setPreviousPaperId("");
                }}
              >
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
              <Label>Current paper</Label>
              <Select value={currentPaperId} onValueChange={setCurrentPaperId} disabled={!courseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select paper" />
                </SelectTrigger>
                <SelectContent>
                  {papers.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.semester} {p.year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Previous paper</Label>
              <Select value={previousPaperId} onValueChange={setPreviousPaperId} disabled={!courseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select paper" />
                </SelectTrigger>
                <SelectContent>
                  {papers
                    .filter((p) => String(p.id) !== currentPaperId)
                    .map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.semester} {p.year}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-small text-error">
              {error}
            </div>
          )}

          <div>
            <Button
              onClick={runSimilarityCheck}
              disabled={!currentPaperId || !previousPaperId || analyzeSimilarity.isPending}
            >
              <GitCompareArrows className="h-4 w-4" />
              {analyzeSimilarity.isPending ? "Checking..." : "Run similarity check"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body font-semibold">Question bank</CardTitle>
        </CardHeader>
        <CardContent>
          {courseLoading ? (
            <LoadingState label="Loading questions..." />
          ) : selectedPaper && selectedPaper.questions && selectedPaper.questions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Bloom level</TableHead>
                  <TableHead className="text-right">Marks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedPaper.questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="text-muted-foreground">{q.id}</TableCell>
                    <TableCell className="max-w-md text-foreground">{q.questionText}</TableCell>
                    <TableCell className="text-muted-foreground">{q.topic ?? "—"}</TableCell>
                    <TableCell>{q.bloomLevel ? <Badge variant="outline">{q.bloomLevel}</Badge> : "—"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{q.marks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={FileSearch2}
              title="Select a paper to browse its questions"
              description="Choose a course and a current paper above to see its parsed question bank."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
