"""
Builds ml/training_data.csv: real wells (label=1, "success") + sampled background
points (label=0) for the classifier, plus real depth_m/yield_lpm targets for the
regressors (regressors only ever train on the 576 real rows — no synthetic depth/yield).

Why background points instead of "fake dry wells":
No public source anywhere records failed/dry borewell attempts (verified during the
data-collection pass — see bhujal_ai_data/README.md). Labeling random points as
literal "dry wells" would be fabricating ground truth. Instead this uses
presence-vs-background sampling, the same technique used in species distribution /
ecological niche modeling (MaxEnt etc.) when only positive-class observations exist:
background points get compared against known-productive sites on terrain covariates
(elevation, slope, rainfall, local well density), and the classifier learns what
distinguishes "resembles a productive site" from "generic location in the district".

IMPORTANT — this changes what `success_probability` means for the demo: it is
"how much this location resembles the known productive well cluster", not a true
calibrated P(water found | drill here). Say this explicitly in the pitch; don't
oversell it as validated on real failures.

Elevation for the 576 real wells is reused from wells_consolidated.csv (already
fetched and verified in the data-collection pass) rather than re-queried — only the
300 new background points hit the Open-Meteo API here, to stay well under the rate
limit that broke an earlier version of this script.
"""
import csv
import random
import sys
sys.path.insert(0, ".")
from features import fetch_elevations_batch, compute_slope_nn, nearby_well_features, haversine_m, RAINFALL_ANNUAL_MM

random.seed(42)

WELLS_CSV = "/Users/amudandesikan/Documents/bhujal_ai_data/wells_consolidated.csv"
OUT_CSV = "/Users/amudandesikan/Documents/bhujal_ai/ml/training_data.csv"

N_BACKGROUND = 300
MIN_DIST_FROM_WELL_M = 60  # avoid exact-duplicate locations with real wells

real_wells = []
with open(WELLS_CSV) as f:
    for r in csv.DictReader(f):
        real_wells.append({
            "well_id": r["well_id"],
            "latitude": float(r["latitude"]),
            "longitude": float(r["longitude"]),
            "depth_m": float(r["depth_m"]) if r["depth_m"] else None,
            "yield_lpm": float(r["yield_lpm"]) if r["yield_lpm"] else None,
            "elevation_m": float(r["elevation_m"]) if r["elevation_m"] else None,
        })

print(f"Loaded {len(real_wells)} real wells (elevation reused from wells_consolidated.csv)", flush=True)

lat_min = min(w["latitude"] for w in real_wells)
lat_max = max(w["latitude"] for w in real_wells)
lon_min = min(w["longitude"] for w in real_wells)
lon_max = max(w["longitude"] for w in real_wells)
print(f"bbox: lat [{lat_min},{lat_max}]  lon [{lon_min},{lon_max}]", flush=True)

# --- sample background points, rejecting ones too close to a real well ---
background_points = []
attempts = 0
while len(background_points) < N_BACKGROUND and attempts < N_BACKGROUND * 20:
    attempts += 1
    lat = random.uniform(lat_min, lat_max)
    lon = random.uniform(lon_min, lon_max)
    too_close = any(haversine_m(lat, lon, w["latitude"], w["longitude"]) < MIN_DIST_FROM_WELL_M for w in real_wells)
    if not too_close:
        background_points.append((lat, lon))

print(f"Sampled {len(background_points)} background points ({attempts} attempts)", flush=True)

print("Fetching elevation for background points only (real wells reuse cached values)...", flush=True)
background_elevations = fetch_elevations_batch(background_points)
print("Elevation fetch done.", flush=True)

all_points = [(w["latitude"], w["longitude"]) for w in real_wells] + background_points
all_elevations = [w["elevation_m"] for w in real_wells] + background_elevations
labels = [1] * len(real_wells) + [0] * len(background_points)

print("Computing slope proxy (nearest-neighbor gradient, no API calls)...", flush=True)
slopes = compute_slope_nn(all_points, all_elevations)

print("Computing nearby-well features...", flush=True)
rows = []
for i, (lat, lon) in enumerate(all_points):
    is_real = i < len(real_wells)
    w500, avg_depth_500 = nearby_well_features(lat, lon, real_wells, radius_m=500,
                                                exclude_uid=real_wells[i]["well_id"] if is_real else None)
    w2000, _ = nearby_well_features(lat, lon, real_wells, radius_m=2000,
                                     exclude_uid=real_wells[i]["well_id"] if is_real else None)
    rows.append({
        "latitude": lat,
        "longitude": lon,
        "elevation_m": all_elevations[i],
        "slope_deg": slopes[i],
        "rainfall_mm": RAINFALL_ANNUAL_MM,
        "existing_wells_500m": w500,
        "existing_wells_2km": w2000,
        "avg_depth_nearby": avg_depth_500,
        "depth_m": real_wells[i]["depth_m"] if is_real else "",
        "yield_lpm": real_wells[i]["yield_lpm"] if is_real else "",
        "success": labels[i],
        "is_synthetic_background": 0 if is_real else 1,
    })

fieldnames = ["latitude", "longitude", "elevation_m", "slope_deg", "rainfall_mm",
              "existing_wells_500m", "existing_wells_2km", "avg_depth_nearby",
              "depth_m", "yield_lpm", "success", "is_synthetic_background"]

with open(OUT_CSV, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=fieldnames)
    w.writeheader()
    w.writerows(rows)

print(f"Wrote {OUT_CSV} with {len(rows)} rows ({len(real_wells)} real + {len(background_points)} background)", flush=True)
