"""
Batch scoring — the "Server: batch, nightly/weekly" + "Feature raster generation" +
"Scored tiles" stages from the deck's methodology diagram, condensed into one script
for the prototype.

Coverage: greater Bengaluru — the city plus outskirts (Hoskote, Devanahalli,
Doddaballapur, Nelamangala, Anekal, towards Kanakapura) — on a 1 km grid. The deck
says 30 m; 1 km keeps Open-Meteo elevation calls (standing in for a locally held DEM
raster) in the thousands. Production would read a downloaded DEM with rasterio instead.

Honesty notes:
 - The models' "nearby wells" features come from 576 real borewells, all inside the
   city. Outskirts cells therefore mostly score INSUFFICIENT_DATA — that's the model
   correctly saying it has no evidence there, not a bug.
 - Each cell's district is borrowed from its nearest government monitoring well
   (a Voronoi approximation — no district boundary file is available offline).
 - Groundwater status "Over Exploited" is verified for Bengaluru Urban's taluks only;
   other cells get "Not assessed" rather than a guessed classification.

Output: scoring/tiles/bengaluru.json (+ bengaluru_monitoring_wells.json).
"""
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.neighbors import BallTree

sys.path.insert(0, "../ml")
from features import fetch_elevations_batch, compute_slope_nn, nearby_well_features, RAINFALL_ANNUAL_MM
from decision import decide
from reference_wells import load_reference_wells

BBOX = {"lat_min": 12.60, "lat_max": 13.40, "lon_min": 77.30, "lon_max": 77.95}
GRID_RESOLUTION_DEG = 0.009  # ~1 km
VERIFIED_OVER_EXPLOITED = {"Bengaluru Urban"}  # from bengaluru_extraction.csv (INGRES 2022)
REGION_DISTRICTS = {"Bengaluru Urban", "Bengaluru Rural", "Kolar", "Ramanagara", "Chikkaballapura", "Tumakuru"}
RURAL_WELLS_CSV = "../data/rural/ka_rural_wells.csv"
ELEV_CACHE = "elevation_cache.json"

real_wells = load_reference_wells()

grid_points = []
lat = BBOX["lat_min"]
while lat <= BBOX["lat_max"] + 1e-9:
    lon = BBOX["lon_min"]
    while lon <= BBOX["lon_max"] + 1e-9:
        grid_points.append((round(lat, 5), round(lon, 5)))
        lon += GRID_RESOLUTION_DEG
    lat += GRID_RESOLUTION_DEG
print(f"Grid: {len(grid_points)} cells, ~1 km, bbox {BBOX}", flush=True)

# ---- elevation, cached so an interrupted run (rate limits) resumes where it stopped ----
cache = json.load(open(ELEV_CACHE)) if os.path.exists(ELEV_CACHE) else {}
missing = [p for p in grid_points if f"{p[0]},{p[1]}" not in cache]
print(f"Elevation: {len(grid_points) - len(missing)} cached, {len(missing)} missing", flush=True)

if "--fetch" in sys.argv:
    # full-fidelity path: fetch every missing cell (slow — Open-Meteo rate-limits hard)
    for start in range(0, len(missing), 500):
        chunk = missing[start:start + 500]
        for p, e in zip(chunk, fetch_elevations_batch(chunk, progress=True)):
            cache[f"{p[0]},{p[1]}"] = e
        json.dump(cache, open(ELEV_CACHE, "w"))  # checkpoint every 500 points
    missing = []

# Fast path: fill any cells still missing by inverse-distance interpolation from real
# measured elevations (cached grid cells + the 576 reference wells). Bengaluru sits on a
# gently rolling plateau, so this is a close approximation; run with --fetch for exact values.
known_pts = [tuple(map(float, k.split(","))) for k in cache] + [(w["latitude"], w["longitude"]) for w in real_wells]
known_elev = list(cache.values()) + [w["elevation_m"] for w in real_wells]
elevations_by_key = dict(cache)
if missing:
    ktree = BallTree(np.radians(known_pts), metric="haversine")
    dist, idx = ktree.query(np.radians(missing), k=6)
    for p, d, ix in zip(missing, dist, idx):
        w = 1.0 / np.maximum(d, 1e-9) ** 2
        elevations_by_key[f"{p[0]},{p[1]}"] = float(np.sum(w * np.array(known_elev)[ix]) / np.sum(w))
    print(f"Interpolated elevation for {len(missing)} cells from {len(known_pts)} measured points", flush=True)
elevations = [elevations_by_key[f"{p[0]},{p[1]}"] for p in grid_points]

slopes = compute_slope_nn(grid_points, elevations)

# ---- district per cell from nearest government monitoring well ----
mon = pd.read_csv(RURAL_WELLS_CSV)
mon = mon[mon.latitude.between(BBOX["lat_min"] - 0.1, BBOX["lat_max"] + 0.1)
          & mon.longitude.between(BBOX["lon_min"] - 0.1, BBOX["lon_max"] + 0.1)
          & mon.district.isin(REGION_DISTRICTS)].reset_index(drop=True)
tree = BallTree(np.radians(mon[["latitude", "longitude"]].values), metric="haversine")
_, nn = tree.query(np.radians(np.array(grid_points)), k=1)
cell_district = mon.district.values[nn[:, 0]]

print("Computing nearby-well features...", flush=True)
rows = []
for i, (lat, lon) in enumerate(grid_points):
    w500, avg_depth = nearby_well_features(lat, lon, real_wells, radius_m=500)
    w2000, _ = nearby_well_features(lat, lon, real_wells, radius_m=2000)
    rows.append({"latitude": lat, "longitude": lon, "elevation_m": elevations[i], "slope_deg": slopes[i],
                 "existing_wells_500m": w500, "existing_wells_2km": w2000, "avg_depth_nearby": avg_depth})
df = pd.DataFrame(rows)

clf = joblib.load("../ml/models/success_classifier.joblib")
depth_model = joblib.load("../ml/models/depth_regressor.joblib")
yield_model = joblib.load("../ml/models/yield_regressor.joblib")
medians = json.load(open("../ml/models/feature_medians.json"))

CLASSIFIER_FEATURES = ["elevation_m", "slope_deg", "existing_wells_500m", "existing_wells_2km"]
REGRESSOR_FEATURES = ["elevation_m", "slope_deg", "existing_wells_500m", "existing_wells_2km", "avg_depth_nearby"]
df_reg = df[REGRESSOR_FEATURES].copy()
for c in REGRESSOR_FEATURES:
    df_reg[c] = df_reg[c].fillna(medians[c])

success_proba = clf.predict_proba(df[CLASSIFIER_FEATURES])[:, 1]
depth_pred = depth_model.predict(df_reg)
yield_pred = yield_model.predict(df_reg)

tile_cells = []
for i, row in df.iterrows():
    district = str(cell_district[i])
    category = "Over Exploited" if district in VERIFIED_OVER_EXPLOITED else "Not assessed"
    d = decide(float(success_proba[i]), int(row["existing_wells_2km"]), category)
    tile_cells.append({
        "lat": row["latitude"], "lon": row["longitude"],
        "district": district,
        "success_probability": round(float(success_proba[i]), 3),
        "depth_m": round(float(depth_pred[i]), 1),
        "yield_lpm": round(float(yield_pred[i]), 1),
        "block_category": category,
        "decision": d["decision"],
        "confidence": d["confidence"],
    })

tile = {
    "district": "Greater Bengaluru",
    "resolution_m": 1000,
    "bbox": BBOX,
    "generated_from": "576 real BWSSB/BBMP borewells (reference set) + Open-Meteo elevation/rainfall",
    "rainfall_mm_annual": RAINFALL_ANNUAL_MM,
    "cells": tile_cells,
}
os.makedirs("tiles", exist_ok=True)
with open("tiles/bengaluru.json", "w") as f:
    json.dump(tile, f)

# ---- government monitoring wells in the same area, for the map's groundwater layer ----
mon_in = mon[mon.latitude.between(BBOX["lat_min"], BBOX["lat_max"])
             & mon.longitude.between(BBOX["lon_min"], BBOX["lon_max"])]
def clean(v):
    return None if pd.isna(v) else (round(float(v), 2) if isinstance(v, (float, np.floating)) else v)
wells_out = [{
    "station": r.station, "village": clean(r.village), "tehsil": clean(r.tehsil), "district": r.district,
    "lat": r.latitude, "lon": r.longitude, "well_type": clean(r.well_type), "well_depth_m": clean(r.well_depth_m),
    "recent_depth_to_water_m": clean(r.recent_depth_to_water_m),
    "pre_monsoon_depth_m": clean(r.pre_monsoon_depth_m), "post_monsoon_depth_m": clean(r.post_monsoon_depth_m),
    "trend_m_per_year": clean(r.trend_m_per_year), "first_year": int(r.first_year), "last_year": int(r.last_year),
} for r in mon_in.itertuples()]
with open("tiles/bengaluru_monitoring_wells.json", "w") as f:
    json.dump({"source": "CGWB manual quarterly (NWDP) + figshare QC metadata; see data/rural/README.md",
               "wells": wells_out}, f)

counts = pd.Series([c["decision"] for c in tile_cells]).value_counts().to_dict()
size_kb = os.path.getsize("tiles/bengaluru.json") / 1024
print(f"Wrote tiles/bengaluru.json — {len(tile_cells)} cells, {size_kb:.0f} KB, {counts}", flush=True)
print(f"Wrote tiles/bengaluru_monitoring_wells.json — {len(wells_out)} wells", flush=True)
