from __future__ import annotations

from datetime import datetime, timezone

import httpx


class WorldBankClient:
    BASE_URL = "https://api.worldbank.org/v2"

    def __init__(self, timeout: float = 20.0):
        self.timeout = timeout

    async def observations(self, country: str, indicator: str) -> list[dict]:
        url = f"{self.BASE_URL}/country/{country}/indicator/{indicator}"
        params = {"format": "json", "per_page": "20000"}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()

        if not isinstance(payload, list) or len(payload) < 2 or payload[1] is None:
            return []
        retrieved_at = datetime.now(timezone.utc).isoformat()
        rows = []
        for item in payload[1]:
            if item.get("value") is None:
                continue
            rows.append(
                {
                    "date": str(item.get("date")),
                    "value": float(item.get("value")),
                    "retrieved_at": retrieved_at,
                }
            )
        rows.sort(key=lambda row: row["date"])
        return rows
