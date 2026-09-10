#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/backend"
if [ ! -f data/macro_atlas.db ]; then PYTHONPATH=. python seed_demo.py; fi
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
