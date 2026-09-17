/**
 * Classical test theory item analysis. Pure functions, no LLM: every number here is
 * reproducible from the uploaded marks, which is what makes it credible in moderation.
 */

export interface MarkRow {
  student: string;
  /** questionId -> marks obtained */
  marks: Map<number, number>;
}

export interface ItemInput {
  questionId: number;
  sequenceNumber: number;
  maxMarks: number;
  bloomLevel: string | null;
  topic: string | null;
  text: string;
}

export interface ItemStat {
  questionId: number;
  sequenceNumber: number;
  maxMarks: number;
  text: string;
  bloomLevel: string | null;
  topic: string | null;
  mean: number;
  sd: number;
  /** mean / maxMarks in [0,1]; high = easy. */
  difficulty: number;
  difficultyBand: "EASY" | "MODERATE" | "HARD";
  /** (upper 27% mean - lower 27% mean) / maxMarks. */
  discrimination: number;
  discriminationBand: "EXCELLENT" | "GOOD" | "MARGINAL" | "POOR";
  /** Item vs rest-of-test correlation. */
  pointBiserial: number | null;
  zeroRate: number;
  fullMarksRate: number;
}

export interface GroupAttainment {
  key: string;
  label: string;
  questionCount: number;
  maxMarks: number;
  meanPercent: number;
  /** Share of students scoring >= threshold% of the group's marks. */
  studentsAboveThreshold: number;
  attainmentLevel: 0 | 1 | 2 | 3;
  questionSequence: number[];
}

export interface ItemAnalysisResult {
  students: number;
  items: ItemStat[];
  totals: {
    maxMarks: number;
    mean: number;
    median: number;
    sd: number;
    min: number;
    max: number;
    passMarkPercent: number;
    passRate: number;
    cronbachAlpha: number | null;
    alphaBand: "EXCELLENT" | "GOOD" | "ACCEPTABLE" | "QUESTIONABLE" | "POOR" | null;
  };
  distribution: Array<{ label: string; from: number; to: number; count: number }>;
  bloomAttainment: GroupAttainment[];
  topicAttainment: GroupAttainment[];
  recommendations: Array<{ message: string; priority: "LOW" | "MEDIUM" | "HIGH"; questionId?: number }>;
}

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

function mean(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
}

function median(sorted: number[]): number {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pearson(a: number[], b: number[]): number | null {
  if (a.length < 3) return null;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i += 1) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  if (da === 0 || db === 0) return null;
  return num / Math.sqrt(da * db);
}

function difficultyBand(p: number): ItemStat["difficultyBand"] {
  return p > 0.8 ? "EASY" : p < 0.3 ? "HARD" : "MODERATE";
}

function discriminationBand(d: number): ItemStat["discriminationBand"] {
  return d >= 0.4 ? "EXCELLENT" : d >= 0.3 ? "GOOD" : d >= 0.2 ? "MARGINAL" : "POOR";
}

function alphaBand(alpha: number): NonNullable<ItemAnalysisResult["totals"]["alphaBand"]> {
  return alpha >= 0.9 ? "EXCELLENT" : alpha >= 0.8 ? "GOOD" : alpha >= 0.7 ? "ACCEPTABLE" : alpha >= 0.6 ? "QUESTIONABLE" : "POOR";
}

/** OBE-style bands: level 3 when >=70% of students clear the threshold, 2 at >=60%, 1 at >=50%. */
function attainmentLevel(share: number): GroupAttainment["attainmentLevel"] {
  return share >= 70 ? 3 : share >= 60 ? 2 : share >= 50 ? 1 : 0;
}

export function groupAttainment(
  rows: MarkRow[],
  items: ItemInput[],
  groups: Array<{ key: string; label: string; questionIds: number[] }>,
  thresholdPercent: number
): GroupAttainment[] {
  const byId = new Map(items.map((item) => [item.questionId, item]));
  return groups
    .map((group) => {
      const members = group.questionIds.map((id) => byId.get(id)).filter((item): item is ItemInput => Boolean(item));
      const maxMarks = members.reduce((s, item) => s + item.maxMarks, 0);
      if (!members.length || maxMarks <= 0) return null;
      const percents = rows.map((row) => (members.reduce((s, item) => s + (row.marks.get(item.questionId) ?? 0), 0) / maxMarks) * 100);
      const above = percents.filter((p) => p >= thresholdPercent).length;
      const share = rows.length ? (above / rows.length) * 100 : 0;
      return {
        key: group.key,
        label: group.label,
        questionCount: members.length,
        maxMarks: round(maxMarks),
        meanPercent: round(mean(percents), 1),
        studentsAboveThreshold: round(share, 1),
        attainmentLevel: attainmentLevel(share),
        questionSequence: members.map((item) => item.sequenceNumber).sort((a, b) => a - b),
      };
    })
    .filter((group): group is GroupAttainment => group !== null);
}

export function analyzeItems(
  rows: MarkRow[],
  items: ItemInput[],
  options: { passMarkPercent?: number; thresholdPercent?: number } = {}
): ItemAnalysisResult {
  const passMarkPercent = options.passMarkPercent ?? 40;
  const thresholdPercent = options.thresholdPercent ?? 60;
  const n = rows.length;
  const paperMax = items.reduce((s, item) => s + item.maxMarks, 0);

  const totals = rows.map((row) => items.reduce((s, item) => s + (row.marks.get(item.questionId) ?? 0), 0));
  const ranked = rows.map((row, index) => ({ row, total: totals[index] })).sort((a, b) => b.total - a.total);
  const groupSize = Math.max(1, Math.round(n * 0.27));
  const upper = ranked.slice(0, groupSize).map((r) => r.row);
  const lower = ranked.slice(Math.max(groupSize, n - groupSize)).map((r) => r.row);

  const itemStats: ItemStat[] = items.map((item) => {
    const scores = rows.map((row) => row.marks.get(item.questionId) ?? 0);
    const max = item.maxMarks || Math.max(...scores, 1);
    const m = mean(scores);
    const p = max > 0 ? m / max : 0;
    const d = n >= 4 ? (mean(upper.map((r) => r.marks.get(item.questionId) ?? 0)) - mean(lower.map((r) => r.marks.get(item.questionId) ?? 0))) / max : 0;
    const rest = rows.map((row, index) => totals[index] - scores[index]);
    return {
      questionId: item.questionId,
      sequenceNumber: item.sequenceNumber,
      maxMarks: max,
      text: item.text,
      bloomLevel: item.bloomLevel,
      topic: item.topic,
      mean: round(m),
      sd: round(Math.sqrt(variance(scores))),
      difficulty: round(p, 3),
      difficultyBand: difficultyBand(p),
      discrimination: round(d, 3),
      discriminationBand: discriminationBand(d),
      pointBiserial: n >= 3 ? (pearson(scores, rest) === null ? null : round(pearson(scores, rest)!, 3)) : null,
      zeroRate: round(n ? scores.filter((s) => s <= 0).length / n : 0, 3),
      fullMarksRate: round(n ? scores.filter((s) => s >= max).length / n : 0, 3),
    };
  });

  const sortedTotals = [...totals].sort((a, b) => a - b);
  const totalVar = variance(totals);
  const itemVarSum = items.reduce((s, item) => s + variance(rows.map((row) => row.marks.get(item.questionId) ?? 0)), 0);
  const k = items.length;
  const alpha = k >= 2 && totalVar > 0 && n >= 3 ? (k / (k - 1)) * (1 - itemVarSum / totalVar) : null;
  const passMark = (passMarkPercent / 100) * paperMax;

  const buckets = [
    { label: "0-39%", from: 0, to: 39.99 },
    { label: "40-49%", from: 40, to: 49.99 },
    { label: "50-59%", from: 50, to: 59.99 },
    { label: "60-69%", from: 60, to: 69.99 },
    { label: "70-79%", from: 70, to: 79.99 },
    { label: "80-89%", from: 80, to: 89.99 },
    { label: "90-100%", from: 90, to: 100 },
  ];
  const distribution = buckets.map((bucket) => ({
    ...bucket,
    count: totals.filter((t) => {
      const pct = paperMax > 0 ? (t / paperMax) * 100 : 0;
      return pct >= bucket.from && pct <= bucket.to;
    }).length,
  }));

  const groupBy = (pick: (item: ItemInput) => string | null, fallback: string) => {
    const map = new Map<string, number[]>();
    for (const item of items) {
      const key = (pick(item) ?? "").trim() || fallback;
      map.set(key, [...(map.get(key) ?? []), item.questionId]);
    }
    return [...map.entries()].map(([key, questionIds]) => ({ key, label: key, questionIds }));
  };

  const recommendations: ItemAnalysisResult["recommendations"] = [];
  for (const item of itemStats) {
    if (n >= 4 && item.discrimination < 0.2) {
      recommendations.push({
        questionId: item.questionId,
        priority: item.discrimination < 0 ? "HIGH" : "MEDIUM",
        message: `Q${item.sequenceNumber} does not separate strong from weak students (D = ${item.discrimination})${item.discrimination < 0 ? " — weaker students outscored stronger ones; check the key and wording" : ""}.`,
      });
    }
    if (item.difficultyBand === "HARD" && item.zeroRate >= 0.5) {
      recommendations.push({ questionId: item.questionId, priority: "HIGH", message: `Q${item.sequenceNumber}: ${Math.round(item.zeroRate * 100)}% of students scored zero. Revisit the teaching of this topic or the question's clarity.` });
    } else if (item.difficultyBand === "HARD") {
      recommendations.push({ questionId: item.questionId, priority: "MEDIUM", message: `Q${item.sequenceNumber} was very hard (mean ${Math.round(item.difficulty * 100)}% of marks).` });
    }
    if (item.difficultyBand === "EASY" && item.fullMarksRate >= 0.8) {
      recommendations.push({ questionId: item.questionId, priority: "LOW", message: `Q${item.sequenceNumber}: ${Math.round(item.fullMarksRate * 100)}% earned full marks — consider raising its cognitive level next term.` });
    }
  }
  if (alpha !== null && alpha < 0.7) {
    recommendations.push({ priority: alpha < 0.6 ? "HIGH" : "MEDIUM", message: `Internal consistency is ${alphaBand(alpha).toLowerCase()} (Cronbach's α = ${round(alpha)}). Items with poor discrimination are the usual cause.` });
  }
  const passRate = n ? (totals.filter((t) => t >= passMark).length / n) * 100 : 0;
  if (n >= 5 && passRate < 50) {
    recommendations.push({ priority: "HIGH", message: `Only ${round(passRate, 1)}% of students reached the ${passMarkPercent}% pass mark.` });
  }

  return {
    students: n,
    items: itemStats,
    totals: {
      maxMarks: round(paperMax),
      mean: round(mean(totals)),
      median: round(median(sortedTotals)),
      sd: round(Math.sqrt(totalVar)),
      min: sortedTotals[0] ?? 0,
      max: sortedTotals[sortedTotals.length - 1] ?? 0,
      passMarkPercent,
      passRate: round(passRate, 1),
      cronbachAlpha: alpha === null ? null : round(alpha, 3),
      alphaBand: alpha === null ? null : alphaBand(alpha),
    },
    distribution,
    bloomAttainment: groupAttainment(rows, items, groupBy((item) => item.bloomLevel, "UNLABELLED"), thresholdPercent),
    topicAttainment: groupAttainment(rows, items, groupBy((item) => item.topic, "Unlabelled"), thresholdPercent),
    recommendations,
  };
}

export interface ParsedMarksSheet {
  rows: Array<{ student: string; marks: Map<number, number> }>;
  /** Column headers that could not be mapped to a question sequence number. */
  ignoredColumns: string[];
  /** Question sequence numbers referenced by a header. */
  columns: number[];
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";" || ch === "\t") {
      out.push(cell);
      cell = "";
    } else cell += ch;
  }
  out.push(cell);
  return out.map((c) => c.trim());
}

/**
 * Header: first column = student id; other columns "Q1", "1", "Q 1", "Question 1", "q1 (10)".
 * Columns like "Total" or "Name" are ignored. Blank cells count as 0 (not attempted).
 */
export function parseMarksCsv(csv: string): ParsedMarksSheet {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length);
  if (lines.length < 2) throw new Error("CSV needs a header row and at least one student row");
  const header = splitCsvLine(lines[0]);
  const columns: Array<number | null> = header.map((h, index) => {
    if (index === 0) return null;
    const match = /^(?:q(?:uestion)?\s*\.?\s*)?(\d{1,3})\b/i.exec(h);
    return match ? Number(match[1]) : null;
  });
  const ignoredColumns = header.filter((h, index) => index > 0 && columns[index] === null);
  const seen = new Set<number>();
  for (const seq of columns) {
    if (seq === null) continue;
    if (seen.has(seq)) throw new Error(`Duplicate question column for Q${seq}`);
    seen.add(seq);
  }
  if (!seen.size) throw new Error("No question columns found — use headers like Q1, Q2, …");

  const rows: ParsedMarksSheet["rows"] = [];
  const students = new Set<string>();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const student = cells[0];
    if (!student) continue;
    if (students.has(student)) throw new Error(`Student "${student}" appears more than once`);
    students.add(student);
    const marks = new Map<number, number>();
    columns.forEach((seq, index) => {
      if (seq === null) return;
      const cell = (cells[index] ?? "").trim();
      const blank = cell === "" || /^(-|—|ab|abs|absent|na|n\/a)$/i.test(cell);
      const value = blank ? 0 : Number(cell.replace(/[^\d.\-]/g, ""));
      if (!blank && (cell.replace(/[^\d.\-]/g, "") === "" || !Number.isFinite(value) || value < 0)) {
        throw new Error(`Invalid mark "${cell}" for ${student} in Q${seq}`);
      }
      marks.set(seq, value);
    });
    rows.push({ student, marks });
  }
  if (!rows.length) throw new Error("No student rows found");
  return { rows, ignoredColumns, columns: [...seen].sort((a, b) => a - b) };
}
