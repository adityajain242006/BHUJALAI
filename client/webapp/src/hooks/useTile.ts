import { useEffect, useState, useMemo } from "react";
import { loadTile } from "../lib/api";
import type { Tile, Decision } from "../types";

interface TileState {
  tile: Tile | null;
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  syncedAt: number | null;
}

export function useTile(district = "bengaluru") {
  const [state, setState] = useState<TileState>({
    tile: null,
    loading: true,
    error: null,
    fromCache: false,
    syncedAt: null,
  });

  useEffect(() => {
    let cancelled = false;
    loadTile(district)
      .then((result) => {
        if (cancelled) return;
        setState({
          tile: result.tile,
          loading: false,
          error: null,
          fromCache: result.fromCache,
          syncedAt: result.syncedAt,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState((s) => ({ ...s, loading: false, error: String(err) }));
      });
    return () => {
      cancelled = true;
    };
  }, [district]);

  return state;
}

export interface TileStats {
  total: number;
  byDecision: Record<Decision, number>;
  avgDepth: number;
  avgYield: number;
  avgSuccessProbability: number;
}

/** Real aggregate stats computed from the live tile — no invented numbers. */
export function useTileStats(tile: Tile | null): TileStats | null {
  return useMemo(() => {
    if (!tile) return null;
    const byDecision: Record<Decision, number> = {
      DRILL: 0,
      SURVEY: 0,
      AVOID: 0,
      INSUFFICIENT_DATA: 0,
    };
    let depthSum = 0;
    let yieldSum = 0;
    let probSum = 0;
    for (const c of tile.cells) {
      byDecision[c.decision]++;
      depthSum += c.depth_m;
      yieldSum += c.yield_lpm;
      probSum += c.success_probability;
    }
    const total = tile.cells.length;
    return {
      total,
      byDecision,
      avgDepth: depthSum / total,
      avgYield: yieldSum / total,
      avgSuccessProbability: probSum / total,
    };
  }, [tile]);
}
