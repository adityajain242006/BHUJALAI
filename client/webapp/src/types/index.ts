export type Decision = "DRILL" | "SURVEY" | "AVOID" | "INSUFFICIENT_DATA";
export type Confidence = "high" | "medium" | "low";

export interface Cell {
  lat: number;
  lon: number;
  /** Nearest-monitoring-well district (approximation); absent in older tiles. */
  district?: string;
  success_probability: number;
  depth_m: number;
  yield_lpm: number;
  block_category: string;
  decision: Decision;
  confidence: Confidence;
}

export interface Tile {
  district: string;
  resolution_m: number;
  generated_from: string;
  rainfall_mm_annual: number;
  cells: Cell[];
}

/** A real government groundwater monitoring well (CGWB) — observed data, not a prediction. */
export interface MonitoringWell {
  station: string;
  village: string | null;
  tehsil: string | null;
  district: string;
  lat: number;
  lon: number;
  well_type: string | null;
  well_depth_m: number | null;
  recent_depth_to_water_m: number | null;
  pre_monsoon_depth_m: number | null;
  post_monsoon_depth_m: number | null;
  /** Positive = water table falling (getting deeper), metres per year. */
  trend_m_per_year: number | null;
  first_year: number;
  last_year: number;
}

export interface PredictResponse {
  latitude: number;
  longitude: number;
  district?: string;
  success_probability: number;
  expected_depth_m: number;
  expected_yield_lpm: number;
  sustainability_status: string;
  decision: Decision;
  confidence: Confidence;
  reason: string;
  features_used: {
    elevation_m: number;
    slope_deg: number;
    existing_wells_500m: number;
    existing_wells_2km: number;
    avg_depth_nearby: number | null;
  };
}

/** A cell selected on the map, normalized to the same shape as a /predict response
 * so RecommendationCard/SiteDetailsPanel can render either source identically. */
export interface SelectedSite {
  latitude: number;
  longitude: number;
  success_probability: number;
  expected_depth_m: number;
  expected_yield_lpm: number;
  sustainability_status: string;
  decision: Decision;
  confidence: Confidence;
  reason?: string;
  features_used?: PredictResponse["features_used"];
}
