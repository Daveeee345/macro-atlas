from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from app.analytics.engine import change, percentile_rank, range_stats, real_policy_rate, regime, spread
from app.storage.repository import Repository
from app.coverage import coverage, matches, REQUIRED_INDICATORS

CORE_INDICATORS = [
    "gdp_growth",
    "inflation",
    "policy_rate",
    "gov_10y",
    "current_account",
    "debt_gdp",
    "credit_growth",
]


class MacroService:
    def __init__(self, repo: Repository | None = None):
        self.repo = repo or Repository()

    def metric_summary(self, code: str, indicator_id: str, period: str | None = None) -> dict:
        series = self.repo.indicator_series(code, indicator_id)
        if period:
            series = [row for row in series if row["period"] <= period]
        if not series:
            return {"id": indicator_id, "value": None, "previous": None, "delta": None, "percentile": None, "period": None, "history": []}
        values = [row["value"] for row in series]
        latest = series[-1]
        previous = series[-2] if len(series) > 1 else None
        return {
            "id": indicator_id,
            "value": round(latest["value"], 2),
            "previous": round(previous["value"], 2) if previous else None,
            "delta": change(latest["value"], previous["value"] if previous else None),
            "percentile": percentile_rank(values, latest["value"]),
            "period": latest["period"],
            "observation_date": latest["observation_date"],
            "source": latest["source"],
            "validation_status": latest["validation_status"],
            "range": range_stats(values),
            "history": [
                {"period": row["period"], "date": row["observation_date"], "value": round(row["value"], 2)}
                for row in series[-40:]
            ],
        }

    def country_snapshot(self, code: str, period: str | None = None) -> dict:
        country = self.repo.country(code)
        if not country:
            raise KeyError(code)
        metrics = {indicator: self.metric_summary(code, indicator, period) for indicator in CORE_INDICATORS}

        real_rate_value = real_policy_rate(metrics["policy_rate"]["value"], metrics["inflation"]["value"])
        policy_hist = self.repo.indicator_series(code, "policy_rate")
        inflation_hist = self.repo.indicator_series(code, "inflation")
        if period:
            policy_hist = [row for row in policy_hist if row["period"] <= period]
            inflation_hist = [row for row in inflation_hist if row["period"] <= period]
        n = min(len(policy_hist), len(inflation_hist))
        rr_history = [
            real_policy_rate(policy_hist[-n + i]["value"], inflation_hist[-n + i]["value"])
            for i in range(n)
        ] if n else []
        rr_percentile = percentile_rank(rr_history, real_rate_value)
        metrics["real_policy_rate"] = {
            "id": "real_policy_rate",
            "value": real_rate_value,
            "previous": rr_history[-2] if len(rr_history) > 1 else None,
            "delta": change(real_rate_value, rr_history[-2] if len(rr_history) > 1 else None),
            "percentile": rr_percentile,
            "period": metrics["policy_rate"]["period"],
            "observation_date": metrics["policy_rate"].get("observation_date"),
            "source": "Derived: policy rate - inflation",
            "validation_status": "VALID",
            "range": range_stats(rr_history),
            "history": [
                {"period": policy_hist[-n + i]["period"], "date": policy_hist[-n + i]["observation_date"], "value": rr_history[i]}
                for i in range(n)
            ][-40:],
        }

        macro_regime = regime(metrics["gdp_growth"]["percentile"], metrics["inflation"]["percentile"])
        return {
            **self.repo.metadata(code),
            **country,
            "geographic_region": self.repo.metadata(code).get("region", country["region"]),
            **coverage(metrics),
            "country_code": country["code"], "country_name": country["name"],
            "latitude": country["lat"], "longitude": country["lon"],
            "gdp_weight": country.get("gdp_weight"),
            "metrics": metrics,
            "regime": macro_regime,
            "latest_period": metrics["gdp_growth"]["period"],
        }

    def all_snapshots(self, period: str | None = None) -> list[dict]:
        return [self.country_snapshot(c["code"], period) for c in self.repo.countries()]

    def universe(self, period: str | None = None, universe: str = "all", tier: int | None = None,
                 region: str | None = None, coverage_min: float = 0) -> list[dict]:
        # Only query series for economies present in the analytical repository.
        observed = {c["code"]: self.country_snapshot(c["code"], period) for c in self.repo.countries()}
        empty_metrics = {i: {"id": i, "value": None, "previous": None, "delta": None,
                            "percentile": None, "period": None, "history": []} for i in REQUIRED_INDICATORS}
        output = []
        catalog = {c["code"]: c for c in self.repo.catalog()}
        for code, metadata in {**catalog, **{c: catalog.get(c, {}) for c in observed}}.items():
            snapshot = observed.get(code) or {**metadata, **coverage(empty_metrics), "metrics": empty_metrics,
                "country_code": code, "country_name": metadata["name"], "latitude": metadata["lat"],
                "longitude": metadata["lon"], "gdp_weight": None, "regime": "UNCLASSIFIED", "latest_period": None}
            if matches(snapshot, universe, tier, region, coverage_min):
                output.append(snapshot)
        return sorted(output, key=lambda c: c["name"])

    def coverage_summary(self, period: str | None = None) -> dict:
        countries = self.universe(period)
        return {"total_economies": len(countries),
                "analytical_economies": sum(c["available_indicator_count"] > 0 for c in countries),
                "tiers": {str(t): sum(c["tier"] == t for c in countries) for t in (1, 2, 3)},
                "distribution": {s: sum(c["data_status"] == s for c in countries)
                                 for s in ("FULL", "GOOD", "PARTIAL", "LIMITED", "UNAVAILABLE")},
                "period": period or self.repo.latest_period(),
                "required_indicators": list(REQUIRED_INDICATORS)}

    def regime_map(self, period: str | None = None) -> list[dict]:
        items = []
        for snapshot in self.all_snapshots(period):
            if snapshot["metrics"]["gdp_growth"]["percentile"] is None or snapshot["metrics"]["inflation"]["percentile"] is None:
                continue
            items.append({
                "code": snapshot["code"],
                "name": snapshot["name"],
                "growth_percentile": snapshot["metrics"]["gdp_growth"]["percentile"],
                "inflation_percentile": snapshot["metrics"]["inflation"]["percentile"],
                "regime": snapshot["regime"],
                "gdp_weight": snapshot["gdp_weight"],
            })
        return items

    def policy_map(self, period: str | None = None) -> list[dict]:
        items = []
        for snapshot in self.all_snapshots(period):
            if snapshot["metrics"]["real_policy_rate"]["value"] is None:
                continue
            items.append({
                "code": snapshot["code"],
                "name": snapshot["name"],
                "policy_rate": snapshot["metrics"]["policy_rate"]["value"],
                "inflation": snapshot["metrics"]["inflation"]["value"],
                "real_rate": snapshot["metrics"]["real_policy_rate"]["value"],
                "real_rate_percentile": snapshot["metrics"]["real_policy_rate"]["percentile"],
                "gdp_weight": snapshot["gdp_weight"],
            })
        return sorted(items, key=lambda item: item["real_rate"] if item["real_rate"] is not None else -999, reverse=True)

    def compare(self, left: str, right: str, period: str | None = None) -> dict:
        a = self.country_snapshot(left, period)
        b = self.country_snapshot(right, period)
        ids = ["gdp_growth", "inflation", "policy_rate", "real_policy_rate", "gov_10y", "current_account", "debt_gdp"]
        rows = []
        for indicator in ids:
            am = a["metrics"][indicator]
            bm = b["metrics"][indicator]
            rows.append({
                "indicator": indicator,
                "left": am,
                "right": bm,
                "spread": spread(am["value"], bm["value"]),
            })
        return {"left": {"code": a["code"], "name": a["name"]}, "right": {"code": b["code"], "name": b["name"]}, "rows": rows}

    def snapshots_by_period(self) -> list[dict]:
        periods = self.repo.available_periods()
        output: list[dict] = []
        for period in periods:
            countries: list[dict] = []
            for country in self.repo.countries():
                code = country["code"]
                gp_series = [r for r in self.repo.indicator_series(code, "gdp_growth") if r["period"] <= period]
                inf_series = [r for r in self.repo.indicator_series(code, "inflation") if r["period"] <= period]
                if not gp_series or not inf_series:
                    continue
                gp = gp_series[-1]
                inf = inf_series[-1]
                gp_pct = percentile_rank([r["value"] for r in gp_series], gp["value"])
                inf_pct = percentile_rank([r["value"] for r in inf_series], inf["value"])
                countries.append({
                    "code": code,
                    "growth_percentile": gp_pct,
                    "inflation_percentile": inf_pct,
                    "regime": regime(gp_pct, inf_pct),
                })
            output.append({"period": period, "countries": countries})
        return output

    def system_status(self) -> dict:
        countries = len(self.repo.countries())
        with self.repo.connect() as conn:
            series_count = conn.execute("SELECT COUNT(DISTINCT country_code || ':' || indicator_id) AS c FROM observations").fetchone()["c"]
            observations = conn.execute("SELECT COUNT(*) AS c FROM observations").fetchone()["c"]
            warnings = conn.execute("SELECT COUNT(*) AS c FROM observations WHERE validation_status != 'VALID'").fetchone()["c"]
            last = conn.execute("SELECT MAX(retrieved_at) AS d FROM observations").fetchone()["d"]
        return {
            "mode": "DEMO_SNAPSHOT",
            "countries": countries,
            "series": series_count,
            "observations": observations,
            "validation_warnings": warnings,
            "last_sync": last,
            "latest_period": self.repo.latest_period(),
            "data_label": "DEMO DATA — connect official APIs before production use",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def lineage(self, code: str, indicator_id: str) -> dict:
        indicator = self.repo.indicator(indicator_id)
        latest = self.repo.latest_observation(code, indicator_id)
        if not indicator or not latest:
            raise KeyError(f"{code}:{indicator_id}")
        summary = self.metric_summary(code, indicator_id)
        return {
            "country": self.repo.country(code),
            "indicator": indicator,
            "observation": latest,
            "derived": {
                "historical_percentile": summary["percentile"],
                "historical_window": "demo history / trailing available observations",
            },
            "methodology": "Observed data + deterministic transformations. No forecasting or causal estimation.",
        }
