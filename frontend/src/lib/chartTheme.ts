import { useMemo } from "react";
import { useTheme } from "../context/ThemeContext";

/**
 * Recharts needs concrete colour strings, but the product is themed with CSS
 * variables. This resolves the live token values so charts stay legible in both
 * light and dark mode instead of baking in a light-mode-only palette.
 */
function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? `hsl(${value})` : fallback;
}

export interface ChartTheme {
  grid: string;
  axis: string;
  axisStrong: string;
  track: string;
  surface: string;
  border: string;
  primary: string;
  success: string;
  warning: string;
  error: string;
  /** Ordered ramp for Bloom levels — light to dark, so depth reads as intensity. */
  bloom: string[];
  /** Tooltip styling shared by every chart. */
  tooltip: {
    backgroundColor: string;
    border: string;
    borderRadius: number;
    fontSize: number;
    color: string;
    boxShadow: string;
  };
}

export function useChartTheme(): ChartTheme {
  const { effectiveTheme } = useTheme();

  return useMemo(() => {
    const dark = effectiveTheme === "dark";

    const surface = readVar("--card", dark ? "hsl(156 16% 10%)" : "#ffffff");
    const border = readVar("--border", dark ? "hsl(156 12% 19%)" : "#e4e2d8");
    const foreground = readVar("--foreground", dark ? "hsl(48 20% 95%)" : "#1a211c");
    const muted = readVar("--muted-foreground", dark ? "hsl(150 8% 70%)" : "#5c635c");

    return {
      grid: border,
      axis: muted,
      axisStrong: foreground,
      track: readVar("--muted", dark ? "hsl(156 12% 16%)" : "#efeee6"),
      surface,
      border,
      primary: readVar("--primary", dark ? "#4ba77c" : "#217049"),
      success: readVar("--success", dark ? "#6ec79a" : "#1b6e45"),
      warning: readVar("--warning", dark ? "#e3a54a" : "#9a6516"),
      error: readVar("--error", dark ? "#e07b72" : "#b62f2b"),
      bloom: dark
        ? ["#aedbc3", "#7cc3a0", "#4ba77c", "#2e8b5f", "#217049", "#1b5a3b"]
        : ["#aedbc3", "#7cc3a0", "#4ba77c", "#2e8b5f", "#217049", "#17472f"],
      tooltip: {
        backgroundColor: surface,
        border: `1px solid ${border}`,
        borderRadius: 10,
        fontSize: 13,
        color: foreground,
        boxShadow: dark
          ? "0 10px 24px -8px rgba(0,0,0,0.6)"
          : "0 10px 24px -8px rgba(26,33,28,0.16)",
      },
    };
  }, [effectiveTheme]);
}

/** Score-to-tone mapping used by report heroes and coverage bars. */
export function scoreTone(theme: ChartTheme, score: number): string {
  if (score >= 75) return theme.success;
  if (score >= 50) return theme.warning;
  return theme.error;
}
