from __future__ import annotations

from datetime import datetime, timezone

import httpx


class FredClient:
    BASE_URL = "https://api.stlouisfed.org/fred"

    def __init__(self, api_key: str, timeout: float = 20.0):
        if not api_key:
            raise ValueError("FRED_API_KEY is required for FRED sync")
        self.api_key = api_key
        self.timeout = timeout

    async def observations(
        self,
        series_id: str,
        observation_start: str | None = None,
        units: str | None = None,
        frequency: str | None = None,
    ) -> list[dict]:
        params: dict[str, str] = {
            "series_id": series_id,
            "api_key": self.api_key,
            "file_type": "json",
        }
        if observation_start:
            params["observation_start"] = observation_start
        if units:
            params["units"] = units
        if frequency:
            params["frequency"] = frequency

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(f"{self.BASE_URL}/series/observations", params=params)
            response.raise_for_status()
            payload = response.json()

        retrieved_at = datetime.now(timezone.utc).isoformat()
        rows = []
        for item in payload.get("observations", []):
            raw = item.get("value")
            if raw in (None, "."):
                continue
            rows.append(
                {
                    "date": item.get("date"),
                    "value": float(raw),
                    "vintage_start": item.get("realtime_start"),
                    "vintage_end": item.get("realtime_end"),
                    "retrieved_at": retrieved_at,
                }
            )
        return rows
