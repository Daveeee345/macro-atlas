from __future__ import annotations

import math
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app.config import DB_PATH
from app.storage.repository import Repository
from app.validation.checks import validate_observation

COUNTRIES = [
    ("IDN", "Indonesia", "Asia", -6.2, 106.8, 1.4),
    ("USA", "United States", "North America", 38.9, -77.0, 4.8),
    ("CHN", "China", "Asia", 39.9, 116.4, 3.5),
    ("JPN", "Japan", "Asia", 35.7, 139.7, 2.0),
    ("IND", "India", "Asia", 28.6, 77.2, 2.4),
    ("EUR", "Euro Area", "Europe", 50.1, 8.7, 3.1),
    ("GBR", "United Kingdom", "Europe", 51.5, -0.1, 1.3),
    ("BRA", "Brazil", "Latin America", -15.8, -47.9, 1.2),
]

INDICATORS = [
    ("gdp_growth", "Real GDP Growth", "Growth", "% YoY", "Quarterly", "YoY", "Observed real GDP growth"),
    ("inflation", "Consumer Price Inflation", "Inflation", "% YoY", "Monthly-equivalent demo", "YoY", "Headline consumer price inflation"),
    ("policy_rate", "Central Bank Policy Rate", "Policy", "%", "Decision-based-equivalent demo", "Level", "Policy rate"),
    ("gov_10y", "10Y Government Yield", "Rates", "%", "Daily-equivalent demo", "Level", "10-year sovereign yield"),
    ("current_account", "Current Account Balance", "External", "% GDP", "Quarterly", "Level", "Current account as share of GDP"),
    ("debt_gdp", "Government Debt", "Fiscal", "% GDP", "Annual-equivalent demo", "Level", "Government debt as share of GDP"),
    ("credit_growth", "Private Credit Growth", "Credit", "% YoY", "Quarterly-equivalent demo", "YoY", "Private credit growth"),
]

BASE = {
    "IDN": dict(gdp_growth=5.0, inflation=2.6, policy_rate=6.0, gov_10y=6.7, current_account=-0.8, debt_gdp=39.0, credit_growth=10.2),
    "USA": dict(gdp_growth=2.5, inflation=3.1, policy_rate=5.5, gov_10y=4.2, current_account=-3.0, debt_gdp=122.0, credit_growth=4.8),
    "CHN": dict(gdp_growth=5.2, inflation=0.8, policy_rate=3.45, gov_10y=2.5, current_account=1.4, debt_gdp=84.0, credit_growth=9.0),
    "JPN": dict(gdp_growth=1.0, inflation=2.6, policy_rate=0.1, gov_10y=0.8, current_account=3.5, debt_gdp=252.0, credit_growth=3.2),
    "IND": dict(gdp_growth=6.7, inflation=5.1, policy_rate=6.5, gov_10y=7.1, current_account=-1.2, debt_gdp=82.0, credit_growth=14.0),
    "EUR": dict(gdp_growth=0.5, inflation=2.4, policy_rate=4.5, gov_10y=2.4, current_account=2.1, debt_gdp=89.0, credit_growth=1.5),
    "GBR": dict(gdp_growth=1.1, inflation=4.0, policy_rate=5.25, gov_10y=4.0, current_account=-3.2, debt_gdp=101.0, credit_growth=2.0),
    "BRA": dict(gdp_growth=2.9, inflation=4.6, policy_rate=11.25, gov_10y=10.7, current_account=-1.6, debt_gdp=87.0, credit_growth=8.5),
}

AMP = {
    "gdp_growth": 1.6,
    "inflation": 1.8,
    "policy_rate": 2.0,
    "gov_10y": 1.2,
    "current_account": 1.1,
    "debt_gdp": 8.0,
    "credit_growth": 4.0,
}


def periods():
    out = []
    for year in range(2016, 2027):
        max_q = 2 if year == 2026 else 4
        for q in range(1, max_q + 1):
            out.append((year, q, f"{year}-Q{q}"))
    return out


def value_for(code: str, indicator: str, idx: int, total: int) -> float:
    base = BASE[code][indicator]
    phase = (sum(ord(c) for c in code + indicator) % 17) / 4
    cyc = math.sin(idx / 3.8 + phase) * AMP[indicator]
    drift = ((idx / max(total - 1, 1)) - 1) * (AMP[indicator] * 0.35)

    # Add shared macro episodes purely to make demo visual history expressive.
    shock = 0.0
    if 16 <= idx <= 19:  # 2020-like demo recession episode
        if indicator == "gdp_growth":
            shock = -6.5 + abs(idx - 17.5) * 1.1
        elif indicator == "credit_growth":
            shock = -4.0
    if 23 <= idx <= 31:  # inflation / tightening demo episode
        if indicator == "inflation":
            shock = 2.8 * math.sin((idx - 22) / 9 * math.pi)
        elif indicator == "policy_rate":
            shock = 2.2 * math.sin((idx - 22) / 9 * math.pi)
        elif indicator == "gov_10y":
            shock = 1.4 * math.sin((idx - 22) / 9 * math.pi)

    if indicator == "debt_gdp":
        shock += 8 if 16 <= idx <= 20 else 0

    value = base + cyc + drift + shock
    floors = {"policy_rate": 0.0, "gov_10y": 0.0, "debt_gdp": 1.0}
    if indicator in floors:
        value = max(floors[indicator], value)
    return round(value, 2)


def seed():
    if DB_PATH.exists():
        DB_PATH.unlink()
    repo = Repository(DB_PATH)
    now = datetime.now(timezone.utc).isoformat()

    with repo.connect() as conn:
        conn.executemany("INSERT INTO countries(code,name,region,lat,lon,gdp_weight) VALUES (?,?,?,?,?,?)", COUNTRIES)
        conn.executemany("INSERT INTO indicators(id,name,category,unit,frequency,transformation,description) VALUES (?,?,?,?,?,?,?)", INDICATORS)

    ps = periods()
    for code, *_ in COUNTRIES:
        for indicator, *_ in INDICATORS:
            for idx, (year, q, period) in enumerate(ps):
                value = value_for(code, indicator, idx, len(ps))
                validation = validate_observation(indicator, value)
                observation_date = f"{year}-{q * 3:02d}-28"
                repo.upsert_observation({
                    "country_code": code,
                    "indicator_id": indicator,
                    "period": period,
                    "observation_date": observation_date,
                    "value": value,
                    "source": "DEMO_SYNTHETIC",
                    "retrieved_at": now,
                    "vintage_date": "demo-v1",
                    "validation_status": validation.status,
                })
    print(f"Seeded demo database at {DB_PATH}")


if __name__ == "__main__":
    seed()
