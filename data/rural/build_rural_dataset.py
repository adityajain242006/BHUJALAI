"""
Builds ka_rural_wells.csv — one row per real groundwater monitoring well in Karnataka,
merged from three public sources:

  A. CGWB manual quarterly water levels, Karnataka, 1996-2024 (NWDP)
       -> per-well long-term trend, pre/post-monsoon depth to water
  B. Karnataka GW Dept telemetry, 6-hourly, 2021-2025 (NWDP, pre-summarised by stream_telemetry.py)
       -> per-well recent mean depth + seasonal range
  C. Quality-controlled CGWB levels with well metadata (figshare, doi:10.6084/m9.figshare.29293877, CC BY 4.0)
       -> well TYPE (bore/dug/tube), drilled WELL DEPTH, aquifer type, specific yield

Wells in Bengaluru Urban are flagged (not dropped) so the app can filter to farm areas.

What this data is NOT: none of these sources record whether a farmer's newly drilled
borewell succeeded or failed, nor its yield in L/min. They measure the water table
at monitoring wells. See README.md.
"""
import os
import re

import numpy as np
import pandas as pd

# ---- district name normalisation (sources mix old/new spellings) ----
DISTRICT_ALIASES = {
    "shimoga": "Shivamogga", "shivamogga": "Shivamogga",
    "chikmagalur": "Chikkamagaluru", "chikkamagaluru": "Chikkamagaluru",
    "bagalkot": "Bagalkote", "bagalkote": "Bagalkote",
    "chamarajanagar": "Chamarajanagara", "chamarajanagara": "Chamarajanagara",
    "gulbarga": "Kalaburagi", "kalaburagi": "Kalaburagi",
    "bijapur": "Vijayapura", "vijayapura": "Vijayapura",
    "belgaum": "Belagavi", "belagavi": "Belagavi",
    "bellary": "Ballari", "ballari": "Ballari",
    "mysore": "Mysuru", "mysuru": "Mysuru",
    "tumkur": "Tumakuru", "tumakuru": "Tumakuru",
    "bangalore urban": "Bengaluru Urban", "bengaluru urban": "Bengaluru Urban",
    "bangalore rural": "Bengaluru Rural", "bengaluru rural": "Bengaluru Rural",
    "chikkaballapura": "Chikkaballapura", "chikballapur": "Chikkaballapura", "chikkaballapur": "Chikkaballapura",
    "dakshin kannada": "Dakshina Kannada", "dakshina kannada": "Dakshina Kannada",
    "uttar kannada": "Uttara Kannada", "uttara kannada": "Uttara Kannada",
    "ramanagara": "Ramanagara", "ramanagaram": "Ramanagara",
}


def norm_district(d):
    if not isinstance(d, str):
        return d
    key = re.sub(r"\s+", " ", d.strip().lower())
    return DISTRICT_ALIASES.get(key, d.strip().title())


# ======================= A. CGWB manual quarterly =======================
cols = {"Groundwater Level Quarterly Manual (meter)": "gwl_m", "Data Acquisition Time": "time"}
man = pd.concat([pd.read_csv(f, low_memory=False).rename(columns=cols)
                 for f in ["cgwb_ka_manual_1991_2020.csv", "cgwb_ka_manual_2021_2025.csv"]])
man["time"] = pd.to_datetime(man["time"], format="%d-%m-%Y %H:%M", errors="coerce")
man = man.dropna(subset=["time", "gwl_m", "Latitude", "Longitude"])
man = man[(man.gwl_m > -5) & (man.gwl_m < 200)]  # drop obvious entry errors (e.g. 1374 m)
man["district"] = man["District"].map(norm_district)
man["month"] = man.time.dt.month
man["year_frac"] = man.time.dt.year + (man.time.dt.dayofyear - 1) / 365.25


def summarise_manual(g):
    # trend: least-squares slope of depth-to-water vs time. Positive = water table falling.
    trend = np.nan
    if g.year_frac.nunique() >= 6 and (g.year_frac.max() - g.year_frac.min()) >= 5:
        trend = np.polyfit(g.year_frac, g.gwl_m, 1)[0]
    pre = g.loc[g.month.isin([4, 5, 6]), "gwl_m"]      # pre-monsoon (CGWB May round)
    post = g.loc[g.month.isin([10, 11, 12]), "gwl_m"]  # post-monsoon (CGWB Nov round)
    recent = g.loc[g.time >= g.time.max() - pd.Timedelta(days=3 * 365), "gwl_m"]
    return pd.Series({
        "tehsil": g["Tehsil"].iloc[0], "village": g["Village"].iloc[0],
        "n_readings": len(g),
        "first_year": int(g.time.dt.year.min()), "last_year": int(g.time.dt.year.max()),
        "mean_depth_to_water_m": round(g.gwl_m.mean(), 2),
        "recent_depth_to_water_m": round(recent.mean(), 2),
        "pre_monsoon_depth_m": round(pre.mean(), 2) if len(pre) else np.nan,
        "post_monsoon_depth_m": round(post.mean(), 2) if len(post) else np.nan,
        "trend_m_per_year": round(trend, 3) if not np.isnan(trend) else np.nan,
    })


A = (man.groupby(["Station", "district", "Latitude", "Longitude"])
        .apply(summarise_manual, include_groups=False).reset_index()
        .rename(columns={"Station": "station", "Latitude": "latitude", "Longitude": "longitude"}))
A["seasonal_fluctuation_m"] = (A.pre_monsoon_depth_m - A.post_monsoon_depth_m).round(2)
A["source"] = "CGWB manual quarterly (NWDP)"
print(f"A. CGWB manual: {len(A)} wells")

# ======================= B. Telemetry summary (optional) =======================
if not os.path.exists("ka_telemetry_stations.csv"):
    print("B. Telemetry summary not present (run stream_telemetry.py to add it) — skipping")
    wells = A.copy()
else:
    B = pd.read_csv("ka_telemetry_stations.csv")
    B["district"] = B["district"].map(norm_district)
    B = B.rename(columns={"mean_depth_to_water_m": "recent_depth_to_water_m",
                          "seasonal_range_m": "seasonal_fluctuation_m"})
    B["first_year"] = pd.to_datetime(B.first_reading, format="%d-%m-%Y %H:%M", errors="coerce").dt.year
    B["last_year"] = pd.to_datetime(B.last_reading, format="%d-%m-%Y %H:%M", errors="coerce").dt.year
    B["mean_depth_to_water_m"] = B["recent_depth_to_water_m"]
    B["source"] = "Karnataka GW Dept telemetry (NWDP)"
    B = B[["station", "district", "latitude", "longitude", "tehsil", "village", "n_readings", "first_year",
           "last_year", "mean_depth_to_water_m", "recent_depth_to_water_m", "seasonal_fluctuation_m", "source"]]
    print(f"B. Telemetry: {len(B)} wells")
    wells = pd.concat([A, B], ignore_index=True)

# ======================= C. QC metadata (well type/depth) =======================
QC_ROOT = "qc_gwl_india/Quality_controlled_groundwater_levels_over_India"
QC_META = f"{QC_ROOT}/Input/1_India_GWLs_2000_2024_wells_within_India.csv"   # all wells: type, depth, aquifer
QC_SY = f"{QC_ROOT}/Output/CGWB_India_filtered_GWLs_ref_sy_2000_2022.csv"      # QC'd subset with specific yield
if os.path.exists(QC_META):
    qc = pd.read_csv(QC_META, low_memory=False)
    # "Station Code" is stored in scientific notation (e.g. 1.159E+14) and has lost precision —
    # unrelated wells 100 km apart share a code. Never key on it; use name + coordinates.
    WELL_KEY = ["Station Name", "Latitude", "Longitude"]
    qc = qc[qc["State"].astype(str).str.strip().str.lower() == "karnataka"]
    qc = qc.drop_duplicates(subset=WELL_KEY + ["Type of Well"]).copy()
    if os.path.exists(QC_SY):
        sy = (pd.read_csv(QC_SY, low_memory=False, usecols=WELL_KEY + ["Reference_Sy"])
                .drop_duplicates(subset=WELL_KEY))
        qc = qc.merge(sy, on=WELL_KEY, how="left")
    else:
        qc["Reference_Sy"] = np.nan
    qc = qc.rename(columns={"Latitude": "qc_lat", "Longitude": "qc_lon", "Type of Well": "well_type",
                            "Aquifer Type": "aquifer_type", "Well Depth": "well_depth_m",
                            "Reference_Sy": "specific_yield"})
    qc = qc.dropna(subset=["qc_lat", "qc_lon"])
    qc["well_type"] = qc["well_type"].replace("-", np.nan)
    qc["aquifer_type"] = qc["aquifer_type"].replace("-", np.nan)
    qc["well_depth_m"] = pd.to_numeric(qc["well_depth_m"], errors="coerce")
    print(f"C. QC metadata: {len(qc)} Karnataka wells ({qc.well_type.value_counts().to_dict()})")

    # match each well to the nearest QC station within ~300 m (same physical well, different source)
    from sklearn.neighbors import BallTree
    tree = BallTree(np.radians(qc[["qc_lat", "qc_lon"]].values), metric="haversine")
    dist, idx = tree.query(np.radians(wells[["latitude", "longitude"]].values), k=1)
    dist_m = dist[:, 0] * 6371000
    matched = dist_m < 300
    for col in ["well_type", "aquifer_type", "well_depth_m", "specific_yield"]:
        wells[col] = np.where(matched, qc[col].values[idx[:, 0]], np.nan)
    print(f"   matched well-type/depth metadata onto {matched.sum()} of {len(wells)} wells")
else:
    print("C. QC metadata not found (figshare download not finished?) — skipping well type/depth")
    for col in ["well_type", "aquifer_type", "well_depth_m", "specific_yield"]:
        wells[col] = np.nan

# ======================= flags & output =======================
wells["is_bengaluru_urban"] = wells["district"].eq("Bengaluru Urban")
wells = wells.drop_duplicates(subset=["station", "latitude", "longitude", "source"])

col_order = ["station", "village", "tehsil", "district", "latitude", "longitude", "source", "well_type",
             "aquifer_type", "well_depth_m", "specific_yield", "n_readings", "first_year", "last_year",
             "mean_depth_to_water_m", "recent_depth_to_water_m", "pre_monsoon_depth_m",
             "post_monsoon_depth_m", "seasonal_fluctuation_m", "trend_m_per_year", "is_bengaluru_urban"]
wells = wells[col_order].sort_values(["district", "station"])
wells.to_csv("ka_rural_wells.csv", index=False)

rural = wells[~wells.is_bengaluru_urban]
print(f"\nWrote ka_rural_wells.csv: {len(wells)} wells total, {len(rural)} outside Bengaluru Urban, "
      f"{wells.district.nunique()} districts")
