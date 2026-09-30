import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Droplets } from "lucide-react";
import type { Cell, PredictResponse, MonitoringWell } from "../types";
import { nearestWell, describeTrend } from "../lib/geo";
import { DecisionBadge, ConfidenceIndicator, MetricCard, EmptyState } from "./ui";
import { siteLabel } from "../lib/site";
import { deriveSiteFactors } from "../lib/explain";

const ACTION_COPY: Record<Cell["decision"], { label: string; primary: boolean }> = {
  DRILL: { label: "View drilling plan", primary: false },
  SURVEY: { label: "Request a geophysical survey", primary: false },
  AVOID: { label: "Find safer alternatives", primary: false },
  INSUFFICIENT_DATA: { label: "Find nearby sites with data", primary: false },
};

/**
 * The model has no evidence here (no known borewells within 2 km), so it doesn't
 * predict. Instead of a dead end, show what IS known: the nearest government
 * monitoring well's real observed readings.
 */
function InsufficientDataCard({ cell, wells }: { cell: Cell; wells: MonitoringWell[] }) {
  const nearest = nearestWell(cell.lat, cell.lon, wells);
  const trend = nearest ? describeTrend(nearest.well.trend_m_per_year) : null;
  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
          {siteLabel(cell.lat, cell.lon)}
          {cell.district && ` · ${cell.district}`}
        </div>
        <div className="mt-2">
          <DecisionBadge decision="INSUFFICIENT_DATA" />
        </div>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
          There are no known borewells within 2 km of this spot, so Bhujal AI won't guess a drilling recommendation here.
        </p>
      </div>

      {nearest && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[#eef4f8] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#2a6a94]">
            <Droplets size={13} /> Nearest government monitoring well
          </div>
          <div className="mt-1 font-display text-base font-semibold text-[var(--color-ink)]">
            {nearest.well.village || nearest.well.station}
          </div>
          <div className="text-xs text-[var(--color-ink-muted)]">
            {nearest.km.toFixed(1)} km away · {nearest.well.district}
            {nearest.well.well_type && ` · ${nearest.well.well_type.toLowerCase()}`}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {nearest.well.recent_depth_to_water_m != null && (
              <MetricCard label="Water found at" value={nearest.well.recent_depth_to_water_m.toFixed(1)} unit="m" />
            )}
            {nearest.well.well_depth_m != null && (
              <MetricCard label="Well depth" value={nearest.well.well_depth_m.toFixed(0)} unit="m" />
            )}
          </div>
          {trend && (
            <div
              className="mt-2 text-sm font-medium"
              style={{ color: trend.worrying ? "var(--color-avoid)" : "var(--color-drill)" }}
            >
              {trend.worrying ? "⚠ " : "✓ "}
              Water table {trend.text.toLowerCase()} ({nearest.well.first_year}–{nearest.well.last_year})
            </div>
          )}
          <p className="mt-2 text-[11px] text-[var(--color-ink-muted)]">
            Observed readings from the Central Ground Water Board — not a prediction for this exact spot.
          </p>
        </div>
      )}

      <div className="mt-auto rounded-xl bg-[var(--color-survey-soft)] p-3 text-sm text-[var(--color-ink)]">
        <span className="font-semibold">Suggested next step:</span> a local geophysical survey before drilling here.
      </div>
    </div>
  );
}

export function RecommendationCard({
  cell,
  detail,
  detailLoading,
  wells,
  onViewDetails,
}: {
  cell: Cell | null;
  detail: PredictResponse | null;
  detailLoading: boolean;
  wells: MonitoringWell[];
  onViewDetails: () => void;
}) {
  if (!cell) {
    return (
      <EmptyState
        title="No site selected"
        description="Tap any point on the map to see the AI recommendation for that location — success probability, expected depth, yield and groundwater status."
      />
    );
  }

  if (cell.decision === "INSUFFICIENT_DATA") {
    return <InsufficientDataCard cell={cell} wells={wells} />;
  }

  const action = ACTION_COPY[cell.decision];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
          {siteLabel(cell.lat, cell.lon)}
          {cell.district && ` · ${cell.district}`}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <DecisionBadge decision={cell.decision} />
          <ConfidenceIndicator confidence={cell.confidence} />
        </div>
      </div>

      <motion.div
        key={`${cell.lat}-${cell.lon}-prob`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl bg-[var(--color-soft-green)] px-5 py-4"
      >
        <div className="font-display text-4xl font-extrabold text-[var(--color-primary)]">
          {Math.round(cell.success_probability * 100)}%
        </div>
        <div className="text-sm text-[var(--color-ink-muted)]">Estimated success probability</div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Expected depth" value={cell.depth_m.toFixed(0)} unit="m" />
        <MetricCard label="Expected yield" value={cell.yield_lpm.toFixed(0)} unit="L/min" />
      </div>
      <MetricCard label="Groundwater status" value={cell.block_category} />

      <div>
        <div className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Why this site?</div>
        <AnimatePresence mode="wait">
          {detailLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-5 w-full animate-pulse rounded bg-[var(--color-border)]" />
              ))}
            </div>
          ) : detail ? (
            <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
              {deriveSiteFactors(detail).map((f, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-2 text-sm text-[var(--color-ink)]"
                >
                  {f.ok ? (
                    <Check size={15} className="mt-0.5 shrink-0 text-[var(--color-drill)]" />
                  ) : (
                    <X size={15} className="mt-0.5 shrink-0 text-[var(--color-survey)]" />
                  )}
                  {f.text}
                </motion.li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button
          onClick={onViewDetails}
          className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
        >
          View site details
        </button>
        <button
          disabled
          title="Part of the prototype roadmap — not implemented yet"
          className="cursor-not-allowed rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-muted)]"
        >
          {action.label} <span className="text-xs">(coming soon)</span>
        </button>
      </div>
    </div>
  );
}
