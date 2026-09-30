import type { Decision, Confidence } from "../types";

/**
 * Single source of truth for how each decision state is represented — color,
 * icon glyph (redundant with color for accessibility), and farmer-facing copy.
 * Every component (map markers, legend, cards, stats) reads from here so the
 * meaning of a color never drifts between screens.
 */
// Literal hex values (mirroring the --color-* tokens in index.css), not var(...):
// the map draws markers on a <canvas>, which cannot resolve CSS custom properties.
export const DECISION_META: Record<
  Decision,
  { label: string; symbol: string; color: string; soft: string; description: string }
> = {
  DRILL: {
    label: "Drill",
    symbol: "✓",
    color: "#2f7d4f",
    soft: "#e3f1e7",
    description: "Suitable — conditions support drilling here",
  },
  SURVEY: {
    label: "Survey",
    symbol: "!",
    color: "#c9862a",
    soft: "#faedd9",
    description: "Uncertain — a geophysical survey is recommended before drilling",
  },
  AVOID: {
    label: "Avoid",
    symbol: "×",
    color: "#b3413a",
    soft: "#f5e2e0",
    description: "High risk — look at nearby alternatives instead",
  },
  INSUFFICIENT_DATA: {
    label: "Insufficient data",
    symbol: "?",
    color: "#8a8f89",
    soft: "#eceeec",
    description: "Not enough nearby well data to confidently recommend this spot",
  },
};

export const CONFIDENCE_META: Record<Confidence, { label: string; width: string }> = {
  high: { label: "High confidence", width: "90%" },
  medium: { label: "Medium confidence", width: "60%" },
  low: { label: "Low confidence", width: "25%" },
};
