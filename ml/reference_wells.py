"""
The 576 real Bengaluru (BWSSB/BBMP) borewells used as the reference set for the
nearby-well features. Loaded from ml/training_data.csv (the real, non-background
rows) so scoring and the API only depend on files inside this project.
"""
import csv
import os

TRAINING_CSV = os.path.join(os.path.dirname(os.path.abspath(__file__)), "training_data.csv")


def load_reference_wells():
    wells = []
    with open(TRAINING_CSV) as f:
        for i, r in enumerate(csv.DictReader(f)):
            if r["is_synthetic_background"] != "0":
                continue
            wells.append({
                "well_id": f"ref-{i}",
                "latitude": float(r["latitude"]),
                "longitude": float(r["longitude"]),
                "depth_m": float(r["depth_m"]) if r["depth_m"] else None,
                "elevation_m": float(r["elevation_m"]) if r["elevation_m"] else None,
            })
    return wells
