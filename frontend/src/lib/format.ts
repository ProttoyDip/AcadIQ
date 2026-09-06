export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Maps a 0-100 quality score to a semantic badge tone. */
export function scoreTone(score: number): "success" | "warning" | "error" {
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "error";
}

export function priorityTone(priority: "LOW" | "MEDIUM" | "HIGH"): "success" | "warning" | "error" {
  if (priority === "LOW") return "success";
  if (priority === "MEDIUM") return "warning";
  return "error";
}

export function bloomLabel(level: string): string {
  return level.charAt(0) + level.slice(1).toLowerCase();
}

export function reportTypeLabel(reportType: string): string {
  return reportType
    .toLowerCase()
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
