import { FormEvent, useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { courseService } from "../services/courseService";

export default function Courses() {
  const { data: courses, loading, error } = useFetch(() => courseService.list(), []);
  const [form, setForm] = useState({ courseCode: "", courseName: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await courseService.create(form);
      setForm({ courseCode: "", courseName: "", description: "" });
      setRefreshKey((k) => k + 1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6" key={refreshKey}>
      <h1 className="text-xl font-semibold text-slate-900">Course management</h1>

      <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4">
        <input placeholder="Course code (e.g. CSE 3811)" required value={form.courseCode} onChange={(e) => setForm({ ...form, courseCode: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input placeholder="Course name" required value={form.courseName} onChange={(e) => setForm({ ...form, courseName: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
        <button disabled={submitting} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {submitting ? "Adding..." : "Add course"}
        </button>
      </form>

      {loading && <p className="text-sm text-slate-400">Loading courses...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {courses?.map((course: any) => (
          <div key={course.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium uppercase text-brand-600">{course.courseCode}</p>
            <p className="mt-1 font-semibold text-slate-900">{course.courseName}</p>
            <p className="mt-2 text-sm text-slate-500">{course.description ?? "No description provided."}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
