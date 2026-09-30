import { motion } from "framer-motion";
import type { Decision, Confidence } from "../types";
import { DECISION_META, CONFIDENCE_META } from "../lib/decision";

/** Colored pill with redundant symbol so the decision never depends on color alone. */
export function DecisionBadge({ decision, size = "md" }: { decision: Decision; size?: "sm" | "md" }) {
  const meta = DECISION_META[decision];
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide ${pad}`}
      style={{ backgroundColor: meta.soft, color: meta.color }}
    >
      <span aria-hidden="true">{meta.symbol}</span>
      {meta.label.toUpperCase()}
    </span>
  );
}

export function ConfidenceIndicator({ confidence }: { confidence: Confidence }) {
  const meta = CONFIDENCE_META[confidence];
  return (
    <div className="flex items-center gap-2" role="img" aria-label={meta.label}>
      <div className="h-1.5 w-20 rounded-full bg-[var(--color-border)] overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-[var(--color-primary)]"
          initial={{ width: 0 }}
          animate={{ width: meta.width }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-[var(--color-ink-muted)]">{meta.label}</span>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
    >
      <div className="text-xs text-[var(--color-ink-muted)]">{label}</div>
      <div className="mt-1 font-display text-xl font-bold text-[var(--color-ink)]">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-[var(--color-ink-muted)]">{unit}</span>}
      </div>
    </motion.div>
  );
}

export function MapLegend({ showWells = false }: { showWells?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-sm px-3 py-2.5 shadow-sm">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
        Recommendation
      </div>
      <div className="flex flex-col gap-1">
        {(Object.keys(DECISION_META) as Decision[]).map((d) => (
          <div key={d} className="flex items-center gap-2 text-xs text-[var(--color-ink)]">
            <span
              className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold"
              style={{ backgroundColor: DECISION_META[d].soft, color: DECISION_META[d].color }}
            >
              {DECISION_META[d].symbol}
            </span>
            {DECISION_META[d].label}
          </div>
        ))}
        {showWells && (
          <div className="mt-1 flex items-center gap-2 border-t border-[var(--color-border)] pt-1.5 text-xs text-[var(--color-ink)]">
            <span className="flex h-4 w-4 items-center justify-center">
              <span className="h-2.5 w-2.5 rounded-full border border-white bg-[#2a6a94] shadow-sm" />
            </span>
            Govt. monitoring well
          </div>
        )}
      </div>
    </div>
  );
}

export function OfflineStatus({
  loading,
  fromCache,
  syncedAt,
  error,
}: {
  loading: boolean;
  fromCache: boolean;
  syncedAt: number | null;
  error: string | null;
}) {
  if (loading) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-secondary)]" />
        Syncing…
      </span>
    );
  }
  if (error) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--color-avoid)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-avoid)]" />
        Offline — no cached data
      </span>
    );
  }
  const label = fromCache
    ? `Offline mode · last synced ${timeAgo(syncedAt)}`
    : `Data synced · ${timeAgo(syncedAt)}`;
  return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-drill)]" />
      {label}
    </span>
  );
}

function timeAgo(ts: number | null): string {
  if (!ts) return "just now";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-soft-green)]/40 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-insufficient-soft)] text-lg font-bold text-[var(--color-insufficient)]">
        ?
      </div>
      <h3 className="font-display text-base font-semibold text-[var(--color-ink)]">{title}</h3>
      <p className="max-w-xs text-sm text-[var(--color-ink-muted)]">{description}</p>
      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-hover)]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function LoadingSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="h-6 w-2/3 animate-pulse rounded bg-[var(--color-border)]" />
      <div className="h-40 w-full animate-pulse rounded-xl bg-[var(--color-border)]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 animate-pulse rounded-xl bg-[var(--color-border)]" />
        <div className="h-16 animate-pulse rounded-xl bg-[var(--color-border)]" />
      </div>
    </div>
  );
}
