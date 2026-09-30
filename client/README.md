# Bhujal AI — Flutter Web Client (prototype)

Built and verified — see `bhujal_app/`. `flutter build web` compiles clean; run with
`flutter run -d chrome` (needs `api/main.py` running on :8000 first). What it does:
1. On first load (or a "Sync" button), fetches `GET /tile/Bengaluru%20Urban` from the
   FastAPI server (`http://localhost:8000`) and caches the JSON in browser storage
   (`shared_preferences` web / `localStorage`) — this simulates the real product's
   "download once over any signal" step.
2. Renders a map (flutter_map + OpenStreetMap tiles for the demo backdrop — the real
   offline product would ship its own base tiles, out of scope for 24hrs) with colored
   markers/circles per grid cell: green = DRILL, yellow = SURVEY, red = AVOID, grey =
   INSUFFICIENT_DATA.
3. Tap a cell (or tap anywhere → snaps to nearest cached cell) → bottom sheet shows
   success_probability, expected_depth_m, expected_yield_lpm, sustainability_status,
   decision + reason — all read from the already-downloaded JSON, zero network calls
   after initial sync. This is the actual "offline-first" claim, demoed honestly.
4. A visible "Offline" indicator once the tile is cached, to make the demo narrative
   obvious to judges without narrating it.

pubspec.yaml dependencies needed: `flutter_map`, `latlong2`, `http`,
`shared_preferences`.
