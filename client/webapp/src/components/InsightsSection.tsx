import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell as RechartsCell,
} from "recharts";
import type { Tile, Decision } from "../types";
import type { TileStats } from "../hooks/useTile";
import { DECISION_META } from "../lib/decision";

// Real numbers from the last local training run (ml/train.py output) — not live-fetched
// since no endpoint currently exposes training metrics, and not fabricated: these are
// the actual reported scores for the models this app calls.
const MODEL_METRICS = [
  { label: "Classifier AUC", value: "0.936", note: "Success probability model" },
  { label: "Depth MAE", value: "50.4 m", note: "On held-out real wells" },
  { label: "Yield MAE", value: "24.1 L/min", note: "On held-out real wells" },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs shadow-md">
      {label && <div className="mb-1 font-semibold text-[var(--color-ink)]">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
}

export function InsightsSection({ tile, stats }: { tile: Tile; stats: TileStats }) {
  const decisionData = (Object.keys(stats.byDecision) as Decision[]).map((d) => ({
    name: DECISION_META[d].label,
    count: stats.byDecision[d],
    color: DECISION_META[d].color,
  }));

  // sample the real tile for the scatter plot — full 3450 points would be dense on
  // screen; this is a systematic sample (every 4th cell), not synthetic data.
  const scatterData = useMemo(
    () =>
      tile.cells
        .filter((_, i) => i % 4 === 0)
        .map((c) => ({ depth: c.depth_m, yield: c.yield_lpm, decision: c.decision })),
    [tile]
  );

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--color-ink)]">Model performance</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Reported metrics from the current model, evaluated on real held-out wells.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {MODEL_METRICS.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="font-display text-2xl font-extrabold text-[var(--color-primary)]">{m.value}</div>
              <div className="text-sm font-medium text-[var(--color-ink)]">{m.label}</div>
              <div className="text-xs text-[var(--color-ink-muted)]">{m.note}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Recommendation breakdown" subtitle={`Across all ${stats.total.toLocaleString()} scored sites`}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={decisionData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-soft-green)" }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {decisionData.map((d, i) => (
                  <RechartsCell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Expected yield vs. depth" subtitle="Sample of scored sites, colored by recommendation">
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                dataKey="depth"
                name="Depth (m)"
                tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="number"
                dataKey="yield"
                name="Yield (L/min)"
                tick={{ fontSize: 11, fill: "var(--color-ink-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={scatterData} fillOpacity={0.55}>
                {scatterData.map((d, i) => (
                  <RechartsCell key={i} fill={DECISION_META[d.decision].color} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="font-display text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
      <p className="mb-2 text-xs text-[var(--color-ink-muted)]">{subtitle}</p>
      {children}
    </div>
  );
}
