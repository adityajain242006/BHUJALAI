"""
Shared feature-engineering for Bhujal AI.

Used by both training (ml/train.py) and batch scoring (scoring/grid_score.py) so the
exact same feature computation runs at train time and score time.

Scope cut for the 24hr prototype (documented, not hidden):
- geology_type, lineament_dist_m, curvature: need GSI Bhukosh shapefiles + rasterio/GDAL,
  neither of which is set up on this machine. Left out of the feature set entirely rather
  than faked. Production would add them as real categorical/vector features.
- slope_deg is a nearest-neighbor elevation-gradient proxy computed from already-fetched
  point elevations (no extra API calls), not a true DEM-derived slope raster. An earlier
  version of this file queried 3-5 offset points per location to approximate slope, which
  multiplied Open-Meteo call volume enough to get this session rate-limited (HTTP 429,
  exhausted retries) — replaced with this nearest-neighbor approach, which reuses
  elevations already fetched for the point set itself.
- rainfall_mm is a single city-wide 2025 annual total (Bengaluru is small enough that
  intra-city rainfall variation is not the dominant signal). Production would sample
  per-cell from IMD gridded rainfall.
"""
import math
import statistics
import time
import urllib.request
import urllib.error
import json

import numpy as np
from sklearn.neighbors import BallTree

OPEN_METEO_ELEVATION = "https://api.open-meteo.com/v1/elevation"
RAINFALL_ANNUAL_MM = 1034.8  # verified real Bengaluru 2025 total, see bhujal_ai_data/README.md
BLOCK_CATEGORY = "Over Exploited"  # verified real: every Bengaluru Urban taluk, see bengaluru_extraction.csv

EARTH_RADIUS_M = 6371000


def haversine_m(lat1, lon1, lat2, lon2):
    R = EARTH_RADIUS_M
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def _get_with_retry(url, max_retries=6):
    delay = 5
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < max_retries - 1:
                time.sleep(delay)
                delay *= 2
                continue
            raise


def fetch_elevations_batch(points, pause=3.0, progress=False):
    """points: list of (lat, lon). Returns list of elevation_m, same order. Batches of 100 (API limit)."""
    out = []
    n_batches = (len(points) + 99) // 100
    for bi, i in enumerate(range(0, len(points), 100)):
        chunk = points[i:i + 100]
        lats = ",".join(str(p[0]) for p in chunk)
        lons = ",".join(str(p[1]) for p in chunk)
        url = f"{OPEN_METEO_ELEVATION}?latitude={lats}&longitude={lons}"
        d = _get_with_retry(url)
        out.extend(d["elevation"])
        if progress:
            print(f"  elevation batch {bi + 1}/{n_batches}", flush=True)
        time.sleep(pause)
    return out


def compute_slope_nn(points, elevations):
    """
    Nearest-neighbor elevation-gradient proxy for slope, in degrees. For each point,
    finds its nearest OTHER point (haversine, via sklearn BallTree) and computes
    atan(|elevation difference| / distance). Zero additional network calls — reuses
    elevations already fetched for `points`. Local terrain-roughness signal, not a
    true DEM slope raster (see module docstring).
    """
    n = len(points)
    if n < 2:
        return [0.0] * n
    coords_rad = np.radians(np.array(points, dtype=float))
    tree = BallTree(coords_rad, metric="haversine")
    dist, idx = tree.query(coords_rad, k=2)  # k=2: point itself + nearest other point

    slopes = []
    for i in range(n):
        nn_dist_m = dist[i][1] * EARTH_RADIUS_M
        nn_idx = idx[i][1]
        if nn_dist_m < 1:
            slopes.append(0.0)
            continue
        elev_diff = abs(elevations[i] - elevations[nn_idx])
        grad = math.degrees(math.atan(elev_diff / nn_dist_m))
        slopes.append(round(grad, 3))
    return slopes


def nearby_well_features(lat, lon, reference_wells, radius_m=500, exclude_uid=None):
    """
    reference_wells: list of dicts with 'well_id','latitude','longitude','depth_m'.
    Computed the same way for both real wells (as in bhujal_ai_data build) and synthetic
    grid/background points, against the same real 576-well reference set.
    """
    count = 0
    depths = []
    for w in reference_wells:
        if exclude_uid is not None and w["well_id"] == exclude_uid:
            continue
        d = haversine_m(lat, lon, w["latitude"], w["longitude"])
        if d <= radius_m:
            count += 1
            if w.get("depth_m"):
                depths.append(w["depth_m"])
    avg_depth = round(statistics.mean(depths), 2) if depths else None
    return count, avg_depth


FEATURE_COLUMNS = [
    "elevation_m",
    "slope_deg",
    "rainfall_mm",
    "existing_wells_500m",
    "existing_wells_2km",
]
