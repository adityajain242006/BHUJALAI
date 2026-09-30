import { motion } from "framer-motion";
import type { PredictResponse } from "../types";

interface Bar {
  label: string;
  value: number; // 0-100
}

/**
 * Real, transparent indicators derived from the same feature values shown
 * elsewhere on the page — not model feature importance (no SHAP computed),
 * and explicitly not a geology/rainfall score, since we don't have that data
 * for this prototype. Normalization ranges below come from the training
 * dataset's observed spread (ml/training_data.csv), not arbitrary guesses.
 */
function computeBars(detail: PredictResponse): Bar[] {
  const f = detail.features_used;
  const wellDensity = clamp((f.existing_wells_2km / 60) * 100);
  const terrain = clamp(100 - (f.slope_deg / 8) * 100);
  const depthConsistency = f.avg_depth_nearby != null ? clamp(80 + Math.min(f.existing_wells_500m, 10) * 2) : 20;
  const bars: Bar[] = [
    { label: "Nearby well density", value: wellDensity },
    { label: "Terrain favorability", value: terrain },
    { label: "Depth consistency", value: depthConsistency },
  ];
  // Only show a sustainability bar where there is an official classification —
  // "Not assessed" areas get no bar rather than an invented middle score.
  const status = detail.sustainability_status.toLowerCase();
  if (status.includes("over")) bars.push({ label: "Groundwater sustainability", value: 30 });
  else if (status.includes("safe")) bars.push({ label: "Groundwater sustainability", value: 90 });
  else if (status.includes("critical")) bars.push({ label: "Groundwater sustainability", value: 50 });
  return bars;
}

function clamp(n: number) {
  return Math.max(4, Math.min(100, Math.round(n)));
}

export function SuitabilityBreakdown({ detail }: { detail: PredictResponse }) {
  const bars = computeBars(detail);
  return (
    <div className="space-y-3">
      {bars.map((b, i) => (
        <div key={b.label}>
          <div className="mb-1 flex justify-between text-xs text-[var(--color-ink-muted)]">
            <span>{b.label}</span>
            <span className="font-medium text-[var(--color-ink)]">{b.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <motion.div
              className="h-full rounded-full bg-[var(--color-secondary)]"
              initial={{ width: 0 }}
              animate={{ width: `${b.value}%` }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
