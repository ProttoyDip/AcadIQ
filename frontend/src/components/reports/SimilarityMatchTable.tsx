import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { SimilarityMatch } from "../../types";

const matchLabel: Record<SimilarityMatch["matchType"], string> = {
  DUPLICATE: "Duplicate",
  SIMILAR_CONCEPT: "Similar concept",
  REPEATED_PATTERN: "Repeated pattern",
};

function similarityTone(pct: number): "error" | "warning" | "muted" {
  if (pct >= 75) return "error";
  if (pct >= 50) return "warning";
  return "muted";
}

export default function SimilarityMatchTable({ matches }: { matches: SimilarityMatch[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Current Q#</TableHead>
          <TableHead>Previous Q#</TableHead>
          <TableHead>Match type</TableHead>
          <TableHead className="text-right">Similarity</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {matches.map((m, i) => (
          <TableRow key={i}>
            <TableCell className="font-medium text-foreground">#{m.currentQuestionId}</TableCell>
            <TableCell className="text-muted-foreground">#{m.previousQuestionId}</TableCell>
            <TableCell>
              <Badge variant="outline">{matchLabel[m.matchType]}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <Badge variant={similarityTone(m.similarityPercentage)}>{Math.round(m.similarityPercentage)}%</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
