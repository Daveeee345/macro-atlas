"""Official-data sync scaffold.

This file intentionally ships conservative: only explicitly mapped registry entries should be
synced. Add approved series IDs in PRODUCTION_SERIES after validating units/frequency.
"""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

from app.config import FRED_API_KEY
from app.ingestion.fred import FredClient
from app.ingestion.worldbank import WorldBankClient

# Example mappings are intentionally left empty to prevent accidental mixing of wrong series.
PRODUCTION_SERIES: list[dict] = []


async def main():
    if not PRODUCTION_SERIES:
        print("No production series configured. Edit PRODUCTION_SERIES only after source validation.")
        return

    fred = FredClient(FRED_API_KEY) if FRED_API_KEY else None
    wb = WorldBankClient()
    for item in PRODUCTION_SERIES:
        if item["provider"] == "FRED":
            if fred is None:
                raise RuntimeError("FRED_API_KEY missing")
            rows = await fred.observations(item["series_id"], item.get("observation_start"))
        elif item["provider"] == "WORLDBANK":
            rows = await wb.observations(item["country"], item["series_id"])
        else:
            raise ValueError(f"Unsupported provider: {item['provider']}")
        print(item["country"], item["indicator"], len(rows), "rows")


if __name__ == "__main__":
    asyncio.run(main())
