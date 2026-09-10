from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "macro_atlas.db"
REGISTRY_PATH = DATA_DIR / "indicator_registry.yaml"

FRED_API_KEY = os.getenv("FRED_API_KEY", "")
SYNC_TOKEN = os.getenv("MACRO_ATLAS_SYNC_TOKEN", "change-me")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]
