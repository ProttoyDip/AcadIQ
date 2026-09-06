import { useFetch } from "../hooks/useFetch";
import { reportService } from "../services/reportService";
import ReportViewer from "../components/ReportViewer";
import RecommendationPanel from "../components/RecommendationPanel";

export default function Reports() {
  const { data: reports, loading, error } = useFetch(() => reportService.list(), []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">Analysis reports</h1>

      {loading && <p className="text-sm text-slate-400">Loading reports...</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex flex-col gap-4">
        {reports?.map((report: any) => (
          <ReportViewer key={report.id} reportType={report.reportType} createdAt={report.createdAt}>
            <RecommendationPanel recommendations={report.recommendations} />
          </ReportViewer>
        ))}
        {reports?.length === 0 && <p className="text-sm text-slate-400">No reports generated yet.</p>}
      </div>
    </div>
  );
}
