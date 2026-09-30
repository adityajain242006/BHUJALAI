import type { MonitoringWell } from "../types";

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearestWell(
  lat: number,
  lon: number,
  wells: MonitoringWell[]
): { well: MonitoringWell; km: number } | null {
  let best: { well: MonitoringWell; km: number } | null = null;
  for (const w of wells) {
    const km = haversineKm(lat, lon, w.lat, w.lon);
    if (!best || km < best.km) best = { well: w, km };
  }
  return best;
}

/** Farmer-facing reading of a trend value (positive = water table falling). */
export function describeTrend(trend: number | null): { text: string; worrying: boolean } | null {
  if (trend == null) return null;
  if (trend > 0.1) return { text: `Falling ~${trend.toFixed(2)} m/year`, worrying: true };
  if (trend < -0.1) return { text: `Rising ~${Math.abs(trend).toFixed(2)} m/year`, worrying: false };
  return { text: "Stable over time", worrying: false };
}
