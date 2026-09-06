import { useState } from "react";
import { analysisService } from "../services/analysisService";
import AnalysisCard from "../components/AnalysisCard";
import RecommendationPanel from "../components/RecommendationPanel";
import BloomChart from "../components/charts/BloomChart";
import CoverageChart from "../components/charts/CoverageChart";

export default function AnalysisResult() {
  const [courseId, setCourseId] = useState("");
  const [questionPaperId, setQuestionPaperId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const data = await analysisService.analyzeExam(Number(courseId), Number(questionPaperId));
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  const coveredCount = result?.topicCoverage.filter((t: any) => t.coveredInExam).length ?? 0;
  const missingCount = (result?.topicCoverage.length ?? 0) - coveredCount;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-slate-900">AI exam quality analysis</h1>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <input placeholder="Course ID" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <input placeholder="Question paper ID" value={questionPaperId} onChange={(e) => setQuestionPaperId(e.target.value)} className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <button onClick={runAnalysis} disabled={loading} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {loading ? "Analyzing..." : "Run analysis"}
        </button>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {result && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <AnalysisCard title="Overall quality score" value={`${result.overallScore}/100`} />
            <AnalysisCard title="Topics covered" value={`${coveredCount}/${result.topicCoverage.length}`} />
            <AnalysisCard title="Recommendations" value={result.recommendations.length} />
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Bloom's taxonomy distribution</h3>
              <BloomChart data={result.bloomDistribution} />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Topic coverage</h3>
              <CoverageChart covered={coveredCount} missing={missingCount} />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">AI recommendations</h3>
            <RecommendationPanel recommendations={result.recommendations} />
          </div>
        </>
      )}
    </div>
  );
}
