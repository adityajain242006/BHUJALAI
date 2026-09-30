"""
Serving layer from the deck: "FastAPI — not a live API that runs the model per
request. It's the batch scoring layer... outputs the tiles."

For the demo this also exposes a live /predict — useful for showing the pipeline
end-to-end when there's network, and to score points outside the precomputed grid.
The Flutter client's real (offline) path is /tile/{district}, downloaded once.
"""
import json
import os
import sys
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sklearn.neighbors import BallTree

sys.path.insert(0, "../ml")
from features import compute_slope_nn, nearby_well_features
from decision import decide
from reference_wells import load_reference_wells

TILES_DIR = "../scoring/tiles"

app = FastAPI(title="Bhujal AI Scoring API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

CLASSIFIER_FEATURES = ["elevation_m", "slope_deg", "existing_wells_500m", "existing_wells_2km"]
REGRESSOR_FEATURES = ["elevation_m", "slope_deg", "existing_wells_500m", "existing_wells_2km", "avg_depth_nearby"]

clf = joblib.load("../ml/models/success_classifier.joblib")
depth_model = joblib.load("../ml/models/depth_regressor.joblib")
yield_model = joblib.load("../ml/models/yield_regressor.joblib")
medians = json.load(open("../ml/models/feature_medians.json"))

real_wells = load_reference_wells()
_real_well_points = [(w["latitude"], w["longitude"]) for w in real_wells]
_real_well_elevations = [w["elevation_m"] for w in real_wells]

_area_index = {"mtime": None, "tree": None, "cells": None}

# Local elevation lookup (same data grid_score.py uses): measured grid elevations +
# reference wells, inverse-distance weighted. Avoids a live Open-Meteo call per click,
# which hangs for minutes when that API rate-limits.
_elev_cache = json.load(open("../scoring/elevation_cache.json")) if os.path.exists("../scoring/elevation_cache.json") else {}
_elev_pts = [tuple(map(float, k.split(","))) for k in _elev_cache] + _real_well_points
_elev_vals = np.array(list(_elev_cache.values()) + _real_well_elevations, dtype=float)
_elev_tree = BallTree(np.radians(_elev_pts), metric="haversine")


def _local_elevation(lat: float, lon: float) -> float:
    dist, idx = _elev_tree.query(np.radians([[lat, lon]]), k=6)
    w = 1.0 / np.maximum(dist[0], 1e-9) ** 2
    return float(np.sum(w * _elev_vals[idx[0]]) / np.sum(w))


def _area_info(lat: float, lon: float):
    """District + groundwater status for a point, taken from the nearest cell of the
    scored tile, so live /predict and the offline tile never disagree. Re-indexes if
    the tile file is regenerated."""
    path = f"{TILES_DIR}/bengaluru.json"
    mtime = os.path.getmtime(path)
    if _area_index["mtime"] != mtime:
        cells = json.load(open(path))["cells"]
        _area_index.update(mtime=mtime, cells=cells, tree=BallTree(
            np.radians([[c["lat"], c["lon"]] for c in cells]), metric="haversine"))
    _, idx = _area_index["tree"].query(np.radians([[lat, lon]]), k=1)
    cell = _area_index["cells"][idx[0][0]]
    return cell.get("district", "Bengaluru Urban"), cell["block_category"]


@app.get("/health")
def health():
    return {"status": "ok", "reference_wells": len(real_wells)}


@app.get("/predict")
def predict(lat: float, lon: float):
    elevation = _local_elevation(lat, lon)
    # slope via nearest-neighbor gradient against the real-well reference set (no extra API calls)
    slope = compute_slope_nn([(lat, lon)] + _real_well_points, [elevation] + _real_well_elevations)[0]
    w500, avg_depth = nearby_well_features(lat, lon, real_wells, radius_m=500)
    w2000, _ = nearby_well_features(lat, lon, real_wells, radius_m=2000)

    row = {"elevation_m": elevation, "slope_deg": slope,
           "existing_wells_500m": w500, "existing_wells_2km": w2000,
           "avg_depth_nearby": avg_depth if avg_depth is not None else medians["avg_depth_nearby"]}

    X_clf = pd.DataFrame([row])[CLASSIFIER_FEATURES]
    X_reg = pd.DataFrame([row])[REGRESSOR_FEATURES]

    success_probability = float(clf.predict_proba(X_clf)[0, 1])
    depth_m = float(depth_model.predict(X_reg)[0])
    yield_lpm = float(yield_model.predict(X_reg)[0])

    district, category = _area_info(lat, lon)
    d = decide(success_probability, w2000, category)

    return {
        "latitude": lat, "longitude": lon,
        "district": district,
        "success_probability": round(success_probability, 3),
        "expected_depth_m": round(depth_m, 1),
        "expected_yield_lpm": round(yield_lpm, 1),
        "sustainability_status": category,
        "decision": d["decision"],
        "confidence": d["confidence"],
        "reason": d["reason"],
        "features_used": row,
    }


@app.get("/tile/{district}")
def get_tile(district: str):
    path = f"{TILES_DIR}/{district}.json"
    try:
        return json.load(open(path))
    except FileNotFoundError:
        raise HTTPException(404, f"No precomputed tile for '{district}'. Run scoring/grid_score.py first.")


@app.get("/monitoring-wells/{district}")
def get_monitoring_wells(district: str):
    """Real government groundwater monitoring wells in the tile's area (CGWB), with
    depth to water and long-term trend. Generated alongside the tile by grid_score.py."""
    path = f"{TILES_DIR}/{district}_monitoring_wells.json"
    try:
        return json.load(open(path))
    except FileNotFoundError:
        raise HTTPException(404, f"No monitoring-well file for '{district}'. Run scoring/grid_score.py first.")
