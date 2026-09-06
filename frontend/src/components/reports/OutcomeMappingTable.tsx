import { CheckCircle2, XCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";

interface OutcomeMappingTableProps {
  data: { outcome: string; addressed: boolean }[];
}

export default function OutcomeMappingTable({ data }: OutcomeMappingTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Course outcome</TableHead>
          <TableHead className="text-right">Addressed in exam</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium text-foreground">{row.outcome}</TableCell>
            <TableCell className="text-right">
              {row.addressed ? (
                <Badge variant="success" className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Yes
                </Badge>
              ) : (
                <Badge variant="error" className="inline-flex items-center gap-1">
                  <XCircle className="h-3 w-3" /> No
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
