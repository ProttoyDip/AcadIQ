import { useFetch } from "../hooks/useFetch";
import { courseService } from "../services/courseService";
import { reportService } from "../services/reportService";
import AnalysisCard from "../components/AnalysisCard";
import { useAuth } from "../hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: courses } = useFetch(() => courseService.list(), []);
  const { data: reports } = useFetch(() => reportService.list(), []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Welcome back, {user?.name}</h1>
        <p className="text-sm text-slate-500">Here's a snapshot of your academic workflow.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AnalysisCard title="Courses" value={courses?.length ?? "—"} subtitle="Managed by you" />
        <AnalysisCard title="Reports generated" value={reports?.length ?? "—"} subtitle="Exam, syllabus & similarity" />
        <AnalysisCard
          title="High-priority recommendations"
          value={reports?.reduce((acc: number, r: any) => acc + r.recommendations.filter((rec: any) => rec.priority === "HIGH").length, 0) ?? "—"}
          subtitle="Needs faculty review"
        />
      </div>
    </div>
  );
}
