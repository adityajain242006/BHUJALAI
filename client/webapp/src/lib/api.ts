import type { Tile, PredictResponse, MonitoringWell } from "../types";

// Same backend the Flutter client and HTML fallback already talk to — no new
// API surface introduced for this redesign.
export const API_BASE = "http://localhost:8000";

const TILE_CACHE_KEY = "bhujal_tile_bengaluru";
const TILE_CACHE_TIME_KEY = "bhujal_tile_bengaluru_synced_at";

export interface TileLoadResult {
  tile: Tile;
  fromCache: boolean;
  syncedAt: number | null;
}

/**
 * Offline-first fetch: try the network first (fresh data), fall back to the
 * last cached copy in localStorage if the network fails. This is the same
 * "sync once, work offline after" pattern the Flutter and HTML clients use —
 * reused here, not reinvented.
 */
export async function loadTile(district = "bengaluru"): Promise<TileLoadResult> {
  try {
    const resp = await fetch(`${API_BASE}/tile/${district}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const syncedAt = Date.now();
    try {
      localStorage.setItem(TILE_CACHE_KEY, text);
      localStorage.setItem(TILE_CACHE_TIME_KEY, String(syncedAt));
    } catch {
      /* localStorage unavailable (private mode etc.) — non-fatal */
    }
    return { tile: JSON.parse(text) as Tile, fromCache: false, syncedAt };
  } catch (err) {
    const cached = safeGet(TILE_CACHE_KEY);
    if (cached) {
      const syncedAtRaw = safeGet(TILE_CACHE_TIME_KEY);
      return {
        tile: JSON.parse(cached) as Tile,
        fromCache: true,
        syncedAt: syncedAtRaw ? Number(syncedAtRaw) : null,
      };
    }
    throw err;
  }
}

const WELLS_CACHE_KEY = "bhujal_monitoring_wells_bengaluru";

/** Same offline-first pattern as the tile: network first, cached copy as fallback. */
export async function loadMonitoringWells(district = "bengaluru"): Promise<MonitoringWell[]> {
  try {
    const resp = await fetch(`${API_BASE}/monitoring-wells/${district}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    try {
      localStorage.setItem(WELLS_CACHE_KEY, text);
    } catch {
      /* non-fatal */
    }
    return (JSON.parse(text) as { wells: MonitoringWell[] }).wells;
  } catch {
    const cached = safeGet(WELLS_CACHE_KEY);
    return cached ? (JSON.parse(cached) as { wells: MonitoringWell[] }).wells : [];
  }
}

export async function predictPoint(lat: number, lon: number): Promise<PredictResponse> {
  const resp = await fetch(`${API_BASE}/predict?lat=${lat}&lon=${lon}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
