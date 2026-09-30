"""
Streams the Karnataka GW telemetry CSV (hundreds of MB, 6-hourly readings) and keeps
only a per-station summary, so the raw file never has to be stored on disk.
Output: ka_telemetry_stations.csv — one row per station.
"""
import csv
import io
import urllib.request
from datetime import datetime

URL = ("https://nwdp.nwic.gov.in/dataset/832fa98a-93d2-4f5b-8c4a-28964b4993db/resource/"
       "f6178453-cbc0-4005-98b3-8408e6dfc19a/download/gwl_tel_6_hourly_karnataka_gw_ka_2021_2025.csv")

stats = {}
n = 0
with urllib.request.urlopen(URL, timeout=120) as resp:
    reader = csv.DictReader(io.TextIOWrapper(resp, encoding="utf-8", errors="replace"))
    for row in reader:
        n += 1
        if n % 500000 == 0:
            print(f"  {n:,} rows, {len(stats)} stations", flush=True)
        try:
            # telemetry reports depth as a negative number below ground level
            depth = -float(row["Groundwater Level Telemetry 6 Hourly (meter)"])
            lat, lon = float(row["Latitude"]), float(row["Longitude"])
        except (ValueError, KeyError):
            continue
        if not (-5 < depth < 300):  # drop sensor garbage
            continue
        key = (row["Station"], row["District"], lat, lon)
        t = row["Data Acquisition Time"]
        s = stats.get(key)
        if s is None:
            stats[key] = s = {"n": 0, "sum": 0.0, "min": depth, "max": depth, "first": t, "last": t,
                              "tehsil": row.get("Tehsil", ""), "village": row.get("Village", "")}
        s["n"] += 1
        s["sum"] += depth
        s["min"] = min(s["min"], depth)
        s["max"] = max(s["max"], depth)
        s["last"] = t

with open("ka_telemetry_stations.csv", "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["station", "district", "tehsil", "village", "latitude", "longitude", "n_readings",
                "mean_depth_to_water_m", "min_depth_m", "max_depth_m", "seasonal_range_m", "first_reading", "last_reading"])
    for (station, district, lat, lon), s in sorted(stats.items(), key=lambda kv: kv[0][1]):
        w.writerow([station, district, s["tehsil"], s["village"], lat, lon, s["n"], round(s["sum"] / s["n"], 2),
                    round(s["min"], 2), round(s["max"], 2), round(s["max"] - s["min"], 2), s["first"], s["last"]])

print(f"Done: {n:,} rows streamed -> {len(stats)} stations written to ka_telemetry_stations.csv", flush=True)
