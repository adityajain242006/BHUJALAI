import { Suspense, lazy, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown } from "lucide-react";
import type { Cell, PredictResponse } from "../types";
import { DecisionBadge, ConfidenceIndicator } from "./ui";
import { SuitabilityBreakdown } from "./SuitabilityBreakdown";
import { siteLabel } from "../lib/site";

const Terrain3D = lazy(() => import("./Terrain3D").then((m) => ({ default: m.Terrain3D })));

export function SiteDetailsPanel({
  cell,
  detail,
  onClose,
}: {
  cell: Cell;
  detail: PredictResponse | null;
  onClose: () => void;
}) {
  const [showTechnical, setShowTechnical] = useState(false);

  // The AnimatePresence that drives the exit animation lives in App, around the
  // conditional that mounts this panel — it can't live in here, because it would
  // unmount together with the panel and the close animation would never play.
  return (
    <>
      <motion.div
        key="site-details-overlay"
        className="fixed inset-0 z-50 bg-black/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        key="site-details-panel"
        role="dialog"
        aria-label="Site details"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-[var(--color-canvas)] shadow-2xl"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
          <h2 className="font-display text-base font-semibold text-[var(--color-ink)]">Site details</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-ink-muted)] hover:bg-[var(--color-soft-green)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-6 px-5 py-5">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
              {siteLabel(cell.lat, cell.lon)}
            </div>
            <div className="text-xs text-[var(--color-ink-muted)]">
              Lat {cell.lat.toFixed(5)}, Lon {cell.lon.toFixed(5)}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <DecisionBadge decision={cell.decision} />
              <ConfidenceIndicator confidence={cell.confidence} />
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-[var(--color-ink)]">How deep you'll need to drill</div>
            <Suspense
              fallback={
                <div className="flex h-80 w-full items-center justify-center rounded-xl bg-[var(--color-soft-green)]/40 text-sm text-[var(--color-ink-muted)]">
                  Loading 3D view…
                </div>
              }
            >
              <Terrain3D
                depthM={cell.depth_m}
                yieldLpm={cell.yield_lpm}
                avgNearbyDepthM={detail?.features_used.avg_depth_nearby ?? null}
              />
            </Suspense>
            <p className="mt-1.5 text-xs text-[var(--color-ink-muted)]">
              Drilling depth and yield are this site's predictions. The dashed line is the real average depth of known
              wells within 500 m. Rock layers show a typical Bengaluru hard-rock profile for illustration — not a survey of
              this exact site. Drag to tilt.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Success probability" value={`${Math.round(cell.success_probability * 100)}%`} />
            <Detail label="Expected depth" value={`${cell.depth_m.toFixed(1)} m`} />
            <Detail label="Expected yield" value={`${cell.yield_lpm.toFixed(1)} L/min`} />
            <Detail label="Groundwater status" value={cell.block_category} />
          </div>

          {detail && (
            <div>
              <div className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Site factors</div>
              <SuitabilityBreakdown detail={detail} />
            </div>
          )}

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-ink-muted)]">
            <div className="flex justify-between py-0.5">
              <span>Data source</span>
              <span className="font-medium text-[var(--color-ink)]">576 real Bengaluru borewell records</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Model</span>
              <span className="font-medium text-[var(--color-ink)]">Bhujal AI v0.1 (prototype)</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>Map area</span>
              <span className="font-medium text-[var(--color-ink)]">Greater Bengaluru, 1 km grid</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span>District</span>
              <span className="font-medium text-[var(--color-ink)]">{cell.district ?? "Bengaluru Urban"}</span>
            </div>
          </div>

          {detail && (
            <div>
              <button
                onClick={() => setShowTechnical((v) => !v)}
                className="flex w-full items-center justify-between text-sm font-medium text-[var(--color-secondary)]"
              >
                Technical explanation
                <ChevronDown size={16} className={`transition-transform ${showTechnical ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showTechnical && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 space-y-1 rounded-lg bg-[var(--color-soft-green)]/40 p-3 font-mono text-[11px] text-[var(--color-ink-muted)]">
                      <div>elevation_m: {detail.features_used.elevation_m}</div>
                      <div>slope_deg: {detail.features_used.slope_deg}</div>
                      <div>existing_wells_500m: {detail.features_used.existing_wells_500m}</div>
                      <div>existing_wells_2km: {detail.features_used.existing_wells_2km}</div>
                      <div>avg_depth_nearby: {detail.features_used.avg_depth_nearby ?? "n/a"}</div>
                      <div className="mt-1.5 text-[var(--color-ink)]">{detail.reason}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <div className="text-[11px] text-[var(--color-ink-muted)]">{label}</div>
      <div className="font-medium text-[var(--color-ink)]">{value}</div>
    </div>
  );
}
