import { motion } from "framer-motion";
import type { TileStats } from "../hooks/useTile";
import { DECISION_META } from "../lib/decision";

const STAT_ITEMS: { key: keyof TileStats["byDecision"] | "total"; label: string }[] = [
  { key: "total", label: "Sites analyzed" },
  { key: "DRILL", label: "High suitability" },
  { key: "SURVEY", label: "Survey recommended" },
  { key: "AVOID", label: "Avoid" },
];

/** Real aggregate counts from the currently loaded scored grid — never hardcoded. */
export function StatsRow({ stats }: { stats: TileStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STAT_ITEMS.map((item, i) => {
        const value = item.key === "total" ? stats.total : stats.byDecision[item.key];
        const color = item.key === "total" ? "var(--color-primary)" : DECISION_META[item.key].color;
        return (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
          >
            <div className="font-display text-2xl font-extrabold" style={{ color }}>
              {value.toLocaleString()}
            </div>
            <div className="text-xs text-[var(--color-ink-muted)]">{item.label}</div>
          </motion.div>
        );
      })}
    </div>
  );
}
