import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { courseService } from "../../services/courseService";
import { apiErrorMessage } from "../../services/api";
import { NeighbourHit } from "../../types";

/** "Find questions like this" across the whole course bank — pure embedding cosine, no LLM call. */
export default function SimilarQuestionSearch({ courseId }: { courseId: number | null }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<NeighbourHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = useMutation({
    mutationFn: () => courseService.searchQuestions(courseId!, query),
    onSuccess: (r) => {
      setHits(r.hits);
      setError(null);
    },
    onError: (e) => setError(apiErrorMessage(e, "Search failed")),
  });

  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-tight">
          <Search className="h-4 w-4 text-primary-600 dark:text-primary-400" /> Find Questions Like This
        </CardTitle>
        <CardDescription className="text-xs">
          Semantic search over every question ever uploaded to this course. Ranked by embedding cosine — instant, offline, no AI call.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (courseId && query.trim().length >= 3) search.mutate();
          }}
        >
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Paste a draft question or describe a topic…"
            className="h-9 text-xs"
            disabled={!courseId}
          />
          <Button type="submit" size="sm" className="h-9 gap-1.5 text-xs" disabled={!courseId || query.trim().length < 3 || search.isPending}>
            {search.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search
          </Button>
        </form>
        {error && <p className="text-xs text-error">{error}</p>}
        {hits && hits.length === 0 && <p className="text-xs text-muted-foreground">Nothing in this course's bank is close to that (cosine ≥ 0.30).</p>}
        {hits && hits.length > 0 && (
          <ul className="divide-y divide-border/60">
            {hits.map((h) => (
              <li key={h.questionId} className="flex items-start justify-between gap-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="text-foreground">{h.questionText}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Q{h.sequenceNumber} · {h.semester} {h.year}{h.bloomLevel ? ` · ${h.bloomLevel}` : ""}{h.topic ? ` · ${h.topic}` : ""}
                  </p>
                </div>
                <Badge variant={h.nearDuplicate ? "error" : h.cosine >= 0.6 ? "warning" : "muted"} className="shrink-0 tabular-nums">
                  {h.cosine.toFixed(2)}{h.nearDuplicate ? " dup" : ""}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
