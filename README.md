# Bhujal AI — 24hr Prototype (SIH26200)

Matches the deck's 5-component technical approach and 4-stage offline-first
methodology, scoped down to what's buildable and demoable in 24 hours on one laptop.

## What's real vs. scoped-down

| Deck component | Prototype reality |
|---|---|
| ML Modeling (LightGBM/XGBoost) | **Real.** XGBoost classifier + 2 LightGBM regressors, trained on 576 real Bengaluru borewells (`bhujal_ai_data/wells_consolidated.csv`). |
| Geospatial analysis (rasterio/GDAL/GeoPandas) | **Substituted.** No GDAL/rasterio installed and no local DEM/geology rasters downloaded in the time available. Elevation + a slope proxy come from Open-Meteo's API instead of a local raster read; geology/lineament features are left out entirely (not faked). See `ml/features.py` docstring. |
| Data sources (WRIS/INGRES/CGWB/GSI/Bhuvan/IMD) | **Real**, collected in the prior session — see `../bhujal_ai_data/README.md` for exact sources and caveats (notably: zero public dry-well data exists anywhere, so `success=1` for all 576 real rows). |
| Serving (FastAPI) | **Real.** `api/main.py` — a `/tile/{district}` endpoint serving the precomputed scored grid, plus a live `/predict` for demo flexibility. |
| Client (Flutter) | **Real, Flutter Web build** (not native Android/iOS — no toolchain time budget). Builds clean, `client/bhujal_app/`. |
| 30m grid / nightly batch | **Scoped to 500m / one-off run**, same architecture, smaller district and coarser resolution to keep this achievable without a real DEM. |

## Status: built and running

- `ml/models/*.joblib` — trained (classifier AUC 0.936, depth MAE 50m, yield MAE 24 lpm)
- `scoring/tiles/bengaluru.json` — scored (3450 cells, 631KB, 624 DRILL / 1339 AVOID / 1487 INSUFFICIENT_DATA)
- `api/main.py` — running on :8000, smoke-tested (`../smoke_test.sh`)
- `client/bhujal_app/` — Flutter web build compiles clean (`flutter build web`), served on :8081
- `client/web_fallback/index.html` — zero-dependency backup demo (same tile data, plain Leaflet/JS), served on :8080, built while Flutter's SDK was installing as insurance against the 24hr clock

## To re-run everything from scratch

```bash
cd ml
python3 build_training_data.py   # -> ml/training_data.csv (576 real wells + 300 background points)
python3 train.py                 # -> ml/models/*.joblib

cd ../scoring
python3 grid_score.py            # -> scoring/tiles/bengaluru.json

cd ../api
uvicorn main:app --reload --port 8000   # serves GET /tile/bengaluru and GET /predict?lat=&lon=

# in another terminal — either client works standalone against the API above:
cd ../client/bhujal_app && flutter run -d chrome         # real Flutter client
# or
cd ../client/web_fallback && python3 -m http.server 8080  # zero-toolchain fallback
```

## Known rough edges to fix before the actual demo

- Zero `SURVEY` decisions came out of the scored grid — the classifier's probabilities
  are polarized enough that nothing lands in the 0.35–0.65 band. Not a bug, but worth
  either retuning `ml/decision.py`'s thresholds or picking a `/predict` point that
  lands there for the live-demo portion, so judges see all four decision states.
- Depth/yield regressor MAE (50m / 24 lpm) is sizable relative to the value ranges —
  expected given the small feature set (no geology/lineament), but don't present these
  as precise numbers; frame them as directional estimates.
- Both frontends currently point at `http://localhost:8000` hardcoded — fine for a
  local demo, would need an env-configurable base URL for anything beyond that.

## The honest framing for judges

- **success_probability is presence-vs-background**, not P(water|drill) validated
  against real failures — no such data exists publicly for any Indian state (verified,
  not assumed). Say this proactively; it's a real, documented technique (same as
  species-distribution modeling with presence-only data), not a hidden flaw.
- **depth_m and yield_lpm regressors are trained on 100% real data** — no synthetic
  points touch these two targets.
- **Geology/lineament features are the acknowledged gap** — the deck's own
  "Geospatial Analysis" component is the most scoped-down piece here. Framing:
  "here's the real pipeline with real data end-to-end; geology raster integration is
  the next engineering task, not a research question" — that's a stronger claim than
  pretending it's done.
- **One district (Bengaluru Urban), not statewide hard-rock terrain** — the brief's
  own Belgaum example is different geology; this prototype proves the pipeline, not
  statewide generalization.
