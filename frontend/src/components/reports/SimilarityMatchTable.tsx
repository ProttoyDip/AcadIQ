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
  const hasVectors = matches.some((m) => typeof m.vectorSimilarity === "number");
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Current Q#</TableHead>
          <TableHead>Previous Q#</TableHead>
          <TableHead>Match type</TableHead>
          <TableHead>Reasoning</TableHead>
          {hasVectors && <TableHead className="text-right" title="Cosine similarity from the local embedding model; reproducible across runs">Vector cosine</TableHead>}
          <TableHead className="text-right">AI similarity</TableHead>
          <TableHead className="text-right">Confidence</TableHead>
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
            <TableCell className="max-w-md text-small text-muted-foreground">{m.reason}</TableCell>
            {hasVectors && (
              <TableCell className="text-right tabular-nums text-small text-muted-foreground">
                {typeof m.vectorSimilarity === "number" ? m.vectorSimilarity.toFixed(2) : "—"}
              </TableCell>
            )}
            <TableCell className="text-right">
              <Badge variant={similarityTone(m.similarityPercentage)}>{Math.round(m.similarityPercentage)}%</Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex flex-col items-end gap-0.5">
                <Badge variant="outline">{Math.round(m.confidence)}%</Badge>
                {m.votes && (
                  <span className="text-[11px] tabular-nums text-muted-foreground" title="Samples that confirmed this pair">
                    {m.votes} samples{m.contested ? " · contested" : ""}
                  </span>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
