import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Navbar, type Tab } from "./components/Navbar";
import { StatsRow } from "./components/StatsRow";
import { MapView } from "./components/MapView";
import { RecommendationCard } from "./components/RecommendationCard";
import { SiteDetailsPanel } from "./components/SiteDetailsPanel";
import { InsightsSection } from "./components/InsightsSection";
import { GroundwaterSection } from "./components/GroundwaterSection";
import { EmptyState, LoadingSkeleton } from "./components/ui";
import { useTile, useTileStats } from "./hooks/useTile";
import { predictPoint, loadMonitoringWells } from "./lib/api";
import type { Cell, PredictResponse, MonitoringWell } from "./types";

export default function App() {
  const [tab, setTab] = useState<Tab>("explore");
  const tileState = useTile("bengaluru");
  const stats = useTileStats(tileState.tile);

  const [wells, setWells] = useState<MonitoringWell[]>([]);
  useEffect(() => {
    loadMonitoringWells("bengaluru").then(setWells);
  }, []);

  const [selected, setSelected] = useState<Cell | null>(null);
  const [detail, setDetail] = useState<PredictResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // The tile gives us the recommendation instantly (offline-capable). The richer
  // "why" data comes from the live /predict endpoint, fetched only on selection.
  useEffect(() => {
    if (!selected || selected.decision === "INSUFFICIENT_DATA") {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetail(null);
    predictPoint(selected.lat, selected.lon)
      .then((d) => !cancelled && setDetail(d))
      .catch(() => !cancelled && setDetail(null))
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const offline = {
    loading: tileState.loading,
    fromCache: tileState.fromCache,
    syncedAt: tileState.syncedAt,
    error: tileState.error,
  };

  return (
    <div className="min-h-screen">
      <Navbar activeTab={tab} onTabChange={setTab} offline={offline} />

      {tileState.error && !tileState.tile ? (
        <div className="mx-auto max-w-md px-4 py-20">
          <EmptyState
            title="Couldn't load site data"
            description="The scoring server isn't reachable and there's no offline copy yet. Start the API (uvicorn main:app --port 8000) and reload."
          />
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.main
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {tab === "explore" && (
              <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
                {stats ? <StatsRow stats={stats} /> : <div className="h-[74px] animate-pulse rounded-xl bg-[var(--color-border)]" />}

                <div className="flex flex-col gap-4 lg:h-[calc(100vh-220px)] lg:min-h-[560px] lg:flex-row">
                  <div className="h-[60vh] lg:h-full lg:w-[68%]">
                    {tileState.tile ? (
                      <MapView tile={tileState.tile} wells={wells} selected={selected} onSelect={setSelected} />
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink-muted)]">
                        Loading site intelligence…
                      </div>
                    )}
                  </div>
                  <aside className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:w-[32%]">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary)]">
                      AI Recommendation
                    </div>
                    {tileState.loading ? (
                      <LoadingSkeleton />
                    ) : (
                      <RecommendationCard
                        cell={selected}
                        detail={detail}
                        detailLoading={detailLoading}
                        wells={wells}
                        onViewDetails={() => setDetailsOpen(true)}
                      />
                    )}
                  </aside>
                </div>
              </div>
            )}

            {tab === "insights" && tileState.tile && stats && <InsightsSection tile={tileState.tile} stats={stats} />}
            {tab === "groundwater" && tileState.tile && <GroundwaterSection tile={tileState.tile} wells={wells} />}
          </motion.main>
        </AnimatePresence>
      )}

      <AnimatePresence>
        {detailsOpen && selected && (
          <SiteDetailsPanel
            key="site-details"
            cell={selected}
            detail={detail}
            onClose={() => setDetailsOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
