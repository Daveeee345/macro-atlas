from __future__ import annotations

from dataclasses import dataclass
from math import isnan
from statistics import median
from typing import Iterable


def _clean(values: Iterable[float | None]) -> list[float]:
    out: list[float] = []
    for value in values:
        if value is None:
            continue
        try:
            f = float(value)
        except (TypeError, ValueError):
            continue
        if not isnan(f):
            out.append(f)
    return out


def percentile_rank(history: Iterable[float | None], current: float | None) -> float | None:
    """Inclusive percentile rank, deterministic and dependency-light."""
    if current is None:
        return None
    values = _clean(history)
    if not values:
        return None
    less = sum(v < current for v in values)
    equal = sum(v == current for v in values)
    rank = (less + 0.5 * equal) / len(values) * 100
    return round(rank, 1)


def real_policy_rate(policy_rate: float | None, inflation: float | None) -> float | None:
    if policy_rate is None or inflation is None:
        return None
    return round(float(policy_rate) - float(inflation), 2)


def spread(left: float | None, right: float | None) -> float | None:
    if left is None or right is None:
        return None
    return round(float(left) - float(right), 2)


def change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None:
        return None
    return round(float(current) - float(previous), 2)


def regime(growth_percentile: float | None, inflation_percentile: float | None) -> str:
    if growth_percentile is None or inflation_percentile is None:
        return "UNCLASSIFIED"
    high_growth = growth_percentile >= 50
    high_inflation = inflation_percentile >= 50
    if high_growth and high_inflation:
        return "OVERHEATING"
    if high_growth and not high_inflation:
        return "EXPANSION"
    if not high_growth and high_inflation:
        return "STAGFLATION"
    return "SLOWDOWN"


def range_stats(history: Iterable[float | None]) -> dict[str, float | None]:
    values = _clean(history)
    if not values:
        return {"min": None, "median": None, "max": None}
    return {
        "min": round(min(values), 2),
        "median": round(median(values), 2),
        "max": round(max(values), 2),
    }


@dataclass(frozen=True)
class MetricSummary:
    value: float | None
    previous: float | None
    delta: float | None
    percentile: float | None
    period: str | None
    range: dict[str, float | None]
