import type { PredictResponse } from "../types";

export interface SiteFactor {
  ok: boolean;
  text: string;
}

/**
 * Turns the real feature values already returned by /predict into farmer-friendly
 * statements. This is NOT model feature importance (no SHAP is computed) — it's a
 * transparent, rule-based reading of the same numbers already shown elsewhere on
 * the page, phrased in plain language. Labeled as "Site factors" in the UI, never
 * presented as the model's internal reasoning.
 */
export function deriveSiteFactors(detail: PredictResponse): SiteFactor[] {
  const f = detail.features_used;
  const factors: SiteFactor[] = [];

  if (f.existing_wells_2km >= 5) {
    factors.push({ ok: true, text: `Strong groundwater signal — ${f.existing_wells_2km} known wells within 2km` });
  } else if (f.existing_wells_2km >= 2) {
    factors.push({ ok: true, text: `Some nearby well history — ${f.existing_wells_2km} known wells within 2km` });
  } else {
    factors.push({ ok: false, text: "Very little nearby well history to compare against" });
  }

  if (f.slope_deg < 1.5) {
    factors.push({ ok: true, text: "Flat, favorable terrain" });
  } else if (f.slope_deg < 4) {
    factors.push({ ok: true, text: "Moderate terrain slope" });
  } else {
    factors.push({ ok: false, text: "Steeper local terrain than typical" });
  }

  if (f.avg_depth_nearby != null) {
    factors.push({ ok: true, text: `Consistent depth pattern nearby (~${f.avg_depth_nearby.toFixed(0)}m average)` });
  }

  if (detail.sustainability_status.toLowerCase().includes("not assessed")) {
    factors.push({ ok: false, text: "No official groundwater-stress classification for this area yet" });
  } else if (detail.sustainability_status.toLowerCase().includes("over")) {
    factors.push({ ok: false, text: "Groundwater zone is classified Over-Exploited (INGRES)" });
  } else if (detail.sustainability_status.toLowerCase().includes("safe")) {
    factors.push({ ok: true, text: "Groundwater zone is classified Safe (INGRES)" });
  } else {
    factors.push({ ok: true, text: `Groundwater zone status: ${detail.sustainability_status}` });
  }

  return factors;
}
