#!/bin/bash
# Quick end-to-end sanity check once the API is running (uvicorn main:app --port 8000).
set -e
echo "=== /health ==="
curl -s http://localhost:8000/health | python3 -m json.tool

echo "=== /predict on a real well location (should show high existing_wells nearby) ==="
curl -s "http://localhost:8000/predict?lat=13.030246&lon=77.654879" | python3 -m json.tool

echo "=== /predict far from any reference well (should be INSUFFICIENT_DATA) ==="
curl -s "http://localhost:8000/predict?lat=12.90&lon=77.77" | python3 -m json.tool

echo "=== /tile/bengaluru (first 300 chars) ==="
curl -s http://localhost:8000/tile/bengaluru | head -c 300
echo ""
