from __future__ import annotations

import sqlite3
import json
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.config import DB_PATH


SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS countries (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    region TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    gdp_weight REAL NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS country_catalog (
    code TEXT PRIMARY KEY,
    metadata TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS indicators (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    frequency TEXT NOT NULL,
    transformation TEXT,
    description TEXT
);

CREATE TABLE IF NOT EXISTS observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_code TEXT NOT NULL,
    indicator_id TEXT NOT NULL,
    period TEXT NOT NULL,
    observation_date TEXT NOT NULL,
    value REAL NOT NULL,
    source TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    vintage_date TEXT,
    validation_status TEXT NOT NULL DEFAULT 'VALID',
    UNIQUE(country_code, indicator_id, period, vintage_date),
    FOREIGN KEY(country_code) REFERENCES countries(code),
    FOREIGN KEY(indicator_id) REFERENCES indicators(id)
);

CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    inserted_rows INTEGER NOT NULL DEFAULT 0,
    message TEXT
);
"""


class Repository:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.initialize()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def initialize(self) -> None:
        with self.connect() as conn:
            conn.executescript(SCHEMA)
            catalog_path = Path(__file__).resolve().parents[2] / "data" / "country_catalog.json"
            rows = json.loads(catalog_path.read_text())
            conn.executemany("INSERT INTO country_catalog(code, metadata) VALUES (?, ?) ON CONFLICT(code) DO UPDATE SET metadata=excluded.metadata",
                             [(row["code"], json.dumps(row)) for row in rows])

    def catalog(self) -> list[dict]:
        with self.connect() as conn:
            return [json.loads(row["metadata"]) for row in conn.execute("SELECT metadata FROM country_catalog ORDER BY code")]

    def metadata(self, code: str) -> dict:
        with self.connect() as conn:
            row = conn.execute("SELECT metadata FROM country_catalog WHERE code = ?", (code.upper(),)).fetchone()
            return json.loads(row["metadata"]) if row else {}

    def countries(self) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute("SELECT * FROM countries ORDER BY name").fetchall()
            return [dict(row) for row in rows]

    def country(self, code: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM countries WHERE code = ?", (code.upper(),)).fetchone()
            return dict(row) if row else self.metadata(code) or None

    def indicator(self, indicator_id: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM indicators WHERE id = ?", (indicator_id,)).fetchone()
            return dict(row) if row else None

    def indicator_series(self, code: str, indicator_id: str) -> list[dict]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM observations
                WHERE country_code = ? AND indicator_id = ?
                ORDER BY observation_date ASC, id ASC
                """,
                (code.upper(), indicator_id),
            ).fetchall()
            return [dict(row) for row in rows]

    def latest_observation(self, code: str, indicator_id: str) -> dict | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM observations
                WHERE country_code = ? AND indicator_id = ?
                ORDER BY observation_date DESC, id DESC LIMIT 1
                """,
                (code.upper(), indicator_id),
            ).fetchone()
            return dict(row) if row else None

    def latest_period(self) -> str | None:
        with self.connect() as conn:
            row = conn.execute("SELECT MAX(period) AS period FROM observations").fetchone()
            return row["period"] if row and row["period"] else None

    def observations_for_period(self, period: str, indicator_ids: list[str] | None = None) -> list[dict]:
        with self.connect() as conn:
            if indicator_ids:
                placeholders = ",".join("?" for _ in indicator_ids)
                rows = conn.execute(
                    f"SELECT * FROM observations WHERE period = ? AND indicator_id IN ({placeholders})",
                    [period, *indicator_ids],
                ).fetchall()
            else:
                rows = conn.execute("SELECT * FROM observations WHERE period = ?", (period,)).fetchall()
            return [dict(row) for row in rows]

    def available_periods(self) -> list[str]:
        with self.connect() as conn:
            rows = conn.execute("SELECT DISTINCT period FROM observations ORDER BY period").fetchall()
            return [row["period"] for row in rows]

    def upsert_observation(self, row: dict) -> bool:
        with self.connect() as conn:
            before = conn.total_changes
            conn.execute(
                """
                INSERT INTO observations (
                    country_code, indicator_id, period, observation_date, value,
                    source, retrieved_at, vintage_date, validation_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(country_code, indicator_id, period, vintage_date)
                DO UPDATE SET
                    observation_date=excluded.observation_date,
                    value=excluded.value,
                    source=excluded.source,
                    retrieved_at=excluded.retrieved_at,
                    validation_status=excluded.validation_status
                """,
                (
                    row["country_code"], row["indicator_id"], row["period"],
                    row["observation_date"], row["value"], row["source"],
                    row["retrieved_at"], row.get("vintage_date"), row.get("validation_status", "VALID")
                ),
            )
            return conn.total_changes > before
