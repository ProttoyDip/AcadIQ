import { useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { courseService } from "../services/courseService";
import { uploadService } from "../services/uploadService";
import UploadBox from "../components/UploadBox";

export default function UploadDocument() {
  const { data: courses } = useFetch(() => courseService.list(), []);
  const [courseId, setCourseId] = useState<number | "">("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [semester, setSemester] = useState("Spring");
  const [status, setStatus] = useState<string | null>(null);

  async function handleSyllabus(file: File) {
    if (!courseId) return setStatus("Select a course first");
    setStatus("Uploading syllabus...");
    await uploadService.uploadSyllabus(Number(courseId), file);
    setStatus("Syllabus uploaded successfully.");
  }

  async function handleQuestionPaper(file: File) {
    if (!courseId) return setStatus("Select a course first");
    setStatus("Uploading & parsing question paper...");
    await uploadService.uploadQuestionPaper(Number(courseId), year, semester, file);
    setStatus("Question paper uploaded and parsed.");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">Upload documents</h1>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <select value={courseId} onChange={(e) => setCourseId(Number(e.target.value))} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Select course</option>
          {courses?.map((c: any) => (
            <option key={c.id} value={c.id}>{c.courseCode} — {c.courseName}</option>
          ))}
        </select>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select value={semester} onChange={(e) => setSemester(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option>Spring</option>
          <option>Summer</option>
          <option>Fall</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UploadBox label="Upload syllabus" onFileSelected={handleSyllabus} />
        <UploadBox label="Upload question paper" onFileSelected={handleQuestionPaper} />
      </div>

      {status && <p className="text-sm text-slate-600">{status}</p>}
    </div>
  );
}
