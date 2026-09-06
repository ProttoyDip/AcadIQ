import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { CoMapping } from "../../types";

const strengthTone: Record<CoMapping["strength"], "success" | "warning" | "error"> = {
  STRONG: "success",
  MODERATE: "warning",
  WEAK: "error",
};

export default function CoMappingTable({ mappings }: { mappings: CoMapping[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Question</TableHead>
          <TableHead>Course outcome</TableHead>
          <TableHead>Strength</TableHead>
          <TableHead>Why this decision was made</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mappings.map((m, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium text-foreground">#{m.questionId}</TableCell>
            <TableCell className="text-muted-foreground">{m.courseOutcome}</TableCell>
            <TableCell>
              <Badge variant={strengthTone[m.strength]}>{m.strength}</Badge>
            </TableCell>
            <TableCell className="max-w-md text-small text-muted-foreground">{m.rationale}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
