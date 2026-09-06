import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, Plus, UploadCloud } from "lucide-react";
import { useCourses, useCreateCourse } from "../hooks/useCourses";
import { apiErrorMessage } from "../services/api";
import { formatDate } from "../lib/format";
import PageHeader from "../components/layout/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { CardSkeleton } from "../components/ui/loading-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "../components/ui/dialog";

export default function Courses() {
  const { data: courses, isLoading } = useCourses();
  const createCourse = useCreateCourse();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ courseCode: "", courseName: "", description: "" });
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createCourse.mutateAsync(form);
      setForm({ courseCode: "", courseName: "", description: "" });
      setOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create course"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Course management"
        description="Manage the courses you teach and their academic documents."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Add course
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a new course</DialogTitle>
                <DialogDescription>Courses group your syllabus and question papers for AI analysis.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                {error && (
                  <div className="rounded-md border border-error-border bg-error-bg px-3 py-2 text-small text-error">
                    {error}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="courseCode">Course code</Label>
                  <Input
                    id="courseCode"
                    placeholder="CSE 3811"
                    required
                    value={form.courseCode}
                    onChange={(e) => setForm({ ...form, courseCode: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="courseName">Course name</Label>
                  <Input
                    id="courseName"
                    placeholder="Artificial Intelligence"
                    required
                    value={form.courseName}
                    onChange={(e) => setForm({ ...form, courseName: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={createCourse.isPending}>
                    {createCourse.isPending ? "Adding..." : "Add course"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : courses && courses.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50">
                    <GraduationCap className="h-4.5 w-4.5 text-primary-700" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-primary-700">{course.courseCode}</p>
                    <CardTitle className="text-body font-semibold">{course.courseName}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between gap-4">
                <p className="text-small text-muted-foreground">{course.description || "No description provided."}</p>
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">Added {formatDate(course.createdAt)}</span>
                  <Link to="/upload" className="flex items-center gap-1 text-small font-medium text-primary-700 hover:underline">
                    <UploadCloud className="h-3.5 w-3.5" /> Upload documents
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title="No courses yet"
          description="Add your first course to start uploading syllabi and question papers for AI analysis."
          actionLabel="Add course"
          onAction={() => setOpen(true)}
        />
      )}
    </div>
  );
}
