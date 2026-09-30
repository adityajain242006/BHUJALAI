import { useMemo } from "react";
import { motion } from "framer-motion";
import { Server, Grid3x3, Package, Smartphone } from "lucide-react";
import type { Tile, MonitoringWell } from "../types";

const INGRES_CATEGORIES = [
  { name: "Safe", range: "< 70% extraction", color: "var(--color-drill)" },
  { name: "Semi-Critical", range: "70–90%", color: "var(--color-survey)" },
  { name: "Critical", range: "90–100%", color: "#c56a33" },
  { name: "Over-Exploited", range: "> 100%", color: "var(--color-avoid)" },
];

const PIPELINE = [
  { icon: Server, title: "Batch processing", desc: "Groundwater, terrain and well data processed on a server" },
  { icon: Grid3x3, title: "Site scoring grid", desc: "Every grid cell in the area gets a recommendation" },
  { icon: Package, title: "Compact area file", desc: "Scored grid compressed into a small download" },
  { icon: Smartphone, title: "Works offline", desc: "Once synced, lookups need no internet connection" },
];

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function GroundwaterSection({ tile, wells }: { tile: Tile; wells: MonitoringWell[] }) {
  // Official classification per district, as carried in the tile. "Not assessed" means we
  // don't have the INGRES classification for that area — shown as such, never guessed.
  const districtStatus = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of tile.cells) if (c.district && !m.has(c.district)) m.set(c.district, c.block_category);
    return m;
  }, [tile]);

  // Observed conditions per district from real government monitoring wells.
  const districtWells = useMemo(() => {
    const groups = new Map<string, MonitoringWell[]>();
    for (const w of wells) groups.set(w.district, [...(groups.get(w.district) ?? []), w]);
    return [...groups.entries()]
      .map(([district, ws]) => ({
        district,
        count: ws.length,
        medianDepth: median(ws.map((w) => w.recent_depth_to_water_m).filter((v): v is number => v != null)),
        withTrend: ws.filter((w) => w.trend_m_per_year != null).length,
        falling: ws.filter((w) => (w.trend_m_per_year ?? 0) > 0.1).length,
        status: districtStatus.get(district) ?? "Not assessed",
      }))
      .sort((a, b) => b.count - a.count);
  }, [wells, districtStatus]);

  const sizeKb = Math.round(JSON.stringify(tile).length / 1024);

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-6 sm:px-6">
      <div>
        <h2 className="font-display text-xl font-bold text-[var(--color-ink)]">Groundwater sustainability</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Official INGRES classifications measure how much groundwater is extracted relative to recharge.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {INGRES_CATEGORIES.map((c) => (
            <div key={c.name} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="mb-1 h-1.5 w-8 rounded-full" style={{ backgroundColor: c.color }} />
              <div className="text-sm font-semibold text-[var(--color-ink)]">{c.name}</div>
              <div className="text-xs text-[var(--color-ink-muted)]">{c.range}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-bold text-[var(--color-ink)]">Conditions by district</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          Observed at government (CGWB) monitoring wells inside the map area — real readings, not predictions.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-ink-muted)]">
                <th className="px-4 py-2.5 font-medium">District</th>
                <th className="px-4 py-2.5 font-medium">Official status</th>
                <th className="px-4 py-2.5 font-medium">Monitoring wells</th>
                <th className="px-4 py-2.5 font-medium">Typical water depth</th>
                <th className="px-4 py-2.5 font-medium">Water table falling</th>
              </tr>
            </thead>
            <tbody>
              {districtWells.map((d) => (
                <tr key={d.district} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-4 py-2.5 font-medium text-[var(--color-ink)]">{d.district}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={
                        d.status === "Not assessed"
                          ? "text-[var(--color-ink-muted)]"
                          : "font-semibold text-[var(--color-avoid)]"
                      }
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{d.count}</td>
                  <td className="px-4 py-2.5 tabular-nums">{d.medianDepth != null ? `${d.medianDepth.toFixed(1)} m` : "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {d.withTrend ? `${d.falling} of ${d.withTrend} wells` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--color-ink-muted)]">
          All Bengaluru Urban taluks are officially Over-Exploited (INGRES 2022). The outskirts' official classifications
          aren't in this prototype's dataset yet, so they're shown as not assessed rather than guessed. "Falling" means the
          water table has deepened by more than 0.1 m/year over the well's recorded history.
        </p>
      </div>

      <div>
        <h2 className="font-display text-xl font-bold text-[var(--color-ink)]">How Bhujal AI works offline</h2>
        <p className="text-sm text-[var(--color-ink-muted)]">
          The heavy lifting happens once on a server. Your phone only downloads the result.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          {PIPELINE.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-soft-green)]">
                <step.icon size={16} className="text-[var(--color-primary)]" />
              </div>
              <div className="text-sm font-semibold text-[var(--color-ink)]">{step.title}</div>
              <div className="text-xs text-[var(--color-ink-muted)]">{step.desc}</div>
            </motion.div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--color-ink-muted)]">
          Current area file ({tile.district}): {tile.cells.length.toLocaleString()} scored sites, ~{sizeKb} KB,{" "}
          {tile.resolution_m >= 1000 ? `${tile.resolution_m / 1000} km` : `${tile.resolution_m} m`} grid.
        </p>
      </div>
    </div>
  );
}
