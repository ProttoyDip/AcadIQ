import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Progress } from "../ui/progress";
import { Badge } from "../ui/badge";
import { TopicCoverage } from "../../types";

export default function TopicCoverageTable({ data }: { data: TopicCoverage[] }) {
  const totalMarks = data.reduce((sum, d) => sum + d.marksAllocated, 0) || 1;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Topic</TableHead>
          <TableHead>Questions</TableHead>
          <TableHead>Coverage %</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          const pct = Math.round((row.marksAllocated / totalMarks) * 100);
          return (
            <TableRow key={row.topic}>
              <TableCell className="font-medium text-foreground">{row.topic}</TableCell>
              <TableCell className="text-muted-foreground">{row.questionCount}</TableCell>
              <TableCell className="w-40">
                <div className="flex items-center gap-2">
                  <Progress value={pct} className="h-1.5" />
                  <span className="w-9 shrink-0 text-xs text-muted-foreground">{pct}%</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={row.coveredInExam ? "success" : "error"}>
                  {row.coveredInExam ? "Covered" : "Gap"}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
