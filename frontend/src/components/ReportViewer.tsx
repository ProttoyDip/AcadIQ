interface ReportViewerProps {
  reportType: string;
  createdAt: string;
  children: React.ReactNode;
}

export default function ReportViewer({ reportType, createdAt, children }: ReportViewerProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{reportType.replace(/_/g, " ")}</h3>
        <span className="text-xs text-slate-400">{new Date(createdAt).toLocaleString()}</span>
      </div>
      {children}
    </div>
  );
}
