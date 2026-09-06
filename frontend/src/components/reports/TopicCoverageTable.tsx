import { CheckCircle2, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Progress } from "../ui/progress";
import { TopicCoverage } from "../../types";

export default function TopicCoverageTable({ data }: { data: TopicCoverage[] }) {
  const maxMarks = Math.max(...data.map((d) => d.marksAllocated), 1);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Topic</TableHead>
          <TableHead>Questions</TableHead>
          <TableHead>Marks weight</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.topic}>
            <TableCell className="font-medium text-foreground">{row.topic}</TableCell>
            <TableCell className="text-muted-foreground">{row.questionCount}</TableCell>
            <TableCell className="w-40">
              <div className="flex items-center gap-2">
                <Progress value={(row.marksAllocated / maxMarks) * 100} className="h-1.5" />
                <span className="w-8 shrink-0 text-xs text-muted-foreground">{row.marksAllocated}</span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              {row.coveredInExam ? (
                <CheckCircle2 className="ml-auto h-4 w-4 text-success" />
              ) : (
                <XCircle className="ml-auto h-4 w-4 text-error" />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
