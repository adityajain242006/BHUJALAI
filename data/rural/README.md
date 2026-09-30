# Rural Karnataka groundwater data

Collected 2026-09-30 to extend Bhujal AI beyond the 576 Bengaluru city borewells
(`bhujal_ai_data/wells_consolidated.csv`) to the farming districts where the
product's users actually live.

## Output

**`ka_rural_wells.csv`** — one row per real groundwater monitoring well in Karnataka.
Build with `python3 build_rural_dataset.py`.

Current contents: **2,831 wells, 2,757 outside Bengaluru Urban, 28 districts.**
Of the rural wells, 388 are bore wells with a recorded drilled depth (median 56 m,
range 20–202 m, 25 districts), 1,711 are dug wells, and 658 have no type metadata.
2,195 rural wells have enough history (1996–2024) for a long-term trend.

| Column | Meaning |
|---|---|
| station, village, tehsil, district | Location names (district spellings normalised, e.g. Tumkur → Tumakuru) |
| latitude, longitude | Well coordinates |
| source | Which dataset the row comes from |
| well_type, aquifer_type, well_depth_m, specific_yield | From the figshare QC dataset, matched by location (within 300 m). Empty where no match. |
| n_readings, first_year, last_year | How much history the well has |
| mean_depth_to_water_m | Average depth to the water table, metres below ground |
| recent_depth_to_water_m | Average over the well's last 3 years of readings |
| pre_monsoon_depth_m / post_monsoon_depth_m | Average of Apr–Jun / Oct–Dec readings |
| seasonal_fluctuation_m | Pre minus post monsoon — how much the monsoon recharges it |
| trend_m_per_year | Least-squares slope over the full history. **Positive = water table falling** (getting deeper). Only for wells with 5+ years and 6+ readings. |
| is_bengaluru_urban | Flag so the app can filter to farm areas. Not dropped. |

## Sources

| | Dataset | Coverage | Access |
|---|---|---|---|
| A | CGWB Ground Water Level, Manual Quarterly, Karnataka ([NWDP](https://nwdp.nwic.gov.in/dataset/gwl-manual-quarterly-central-ground-water-board-department)) | 2,831 wells, all districts, 1996–2024, ~123k readings | Direct CSV, no login |
| B | Karnataka GW Dept Telemetry, 6-hourly, 2021–2025 ([NWDP](https://nwdp.nwic.gov.in/en/dataset/ground-water-level-telemetry-hourly-karnataka-department)) | ~1,300+ automatic stations statewide | Direct CSV, but several hundred MB. `stream_telemetry.py` summarises it without saving the raw file. **Not included yet** — the run was stopped by a 10-minute time limit before finishing. Run it yourself in a terminal (`python3 stream_telemetry.py`), then re-run the build. |
| C | Quality-controlled CGWB groundwater levels with specific yield, 2000–2022 ([figshare, doi:10.6084/m9.figshare.29293877](https://doi.org/10.6084/m9.figshare.29293877.v3)), from Bhanja et al., *Scientific Data* 2025 | 2,759 wells India-wide; adds well type, well depth, aquifer type | Direct download, **CC BY 4.0 — cite the paper if used** |

Raw files kept here: `cgwb_ka_manual_1991_2020.csv`, `cgwb_ka_manual_2021_2025.csv`, `qc_gwl_india/`.

Data-quality notes handled in the build script:
- CGWB manual readings outside -5…200 m are dropped (e.g. a 1,374 m entry error).
- In the figshare files, **`Station Code` is stored in scientific notation and has lost
  precision** — unrelated wells up to 100 km apart share a code. The script never joins
  on it; wells are matched by name + coordinates, and to CGWB rows by nearest location
  within 300 m.

## Found but not downloadable automatically

Both are on data.gov.in behind a download form (name, email, purpose), so they need a
person to download them. Put the CSVs in this folder.

- **6th Minor Irrigation Census — Village Schedule — Karnataka** —
  <https://www.data.gov.in/resource/6th-minor-irrigation-census-village-schedule-karnataka>
  (file: `KAVillageSchedule.csv`). Village-level counts of irrigation dug wells and
  shallow/medium/deep tubewells, with **how many are not in use and why** (e.g. dried
  up). This is the closest public signal to borewell *failure* rates.
- **Ground Water Level Data under Atal Bhujal Yojana, 2015–2022** —
  <https://www.data.gov.in/catalog/ground-water-level-data-under-atal-bhujal-yojana>
  (file: `Atal_Jal_Disclosed_Ground_Water_Level-2015-2022.csv`). Pre/post-monsoon levels
  in water-stressed farming villages (Kolar, Chikkaballapura, Tumakuru etc.).

## What this data is not

- **Not drilling outcomes.** None of these sources record whether a farmer's newly
  drilled borewell hit water or came up dry, or its yield in L/min. They measure the
  water table at monitoring wells. The success classifier still has no real negative
  examples.
- **Mostly dug wells, not borewells.** CGWB manual monitoring is dominated by open dug
  wells (median water depth ~6 m). The figshare metadata (`well_type`) identifies which
  rows are actual bore/tube wells.
- **Not a drop-in replacement for the Bengaluru model's targets.** The Bengaluru model
  predicts *drilled borewell depth* and *pumping yield*. These rural wells give
  *depth to water table* and *trend* — valuable features and a different target, not
  the same quantity.

Other leads researched but not pulled: the Berambadi watershed / Kabini Critical Zone
Observatory (IISc) monitors ~200 farmer-owned borewells in Gundlupet taluk, but the data
isn't published as an open download — it would need a request to the research team.
CGWB exploratory well records (depth + yield) exist inside per-district aquifer-mapping
PDF reports, not as a dataset.
