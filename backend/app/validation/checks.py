from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ValidationResult:
    status: str
    warnings: list[str]


BOUNDS: dict[str, tuple[float, float]] = {
    "gdp_growth": (-35, 35),
    "inflation": (-20, 150),
    "policy_rate": (-5, 100),
    "gov_10y": (-5, 100),
    "current_account": (-50, 50),
    "debt_gdp": (0, 500),
    "credit_growth": (-100, 200),
}


def validate_observation(indicator_id: str, value: float | None) -> ValidationResult:
    warnings: list[str] = []
    if value is None:
        return ValidationResult("FAILED", ["missing_value"])
    if indicator_id in BOUNDS:
        low, high = BOUNDS[indicator_id]
        if not (low <= float(value) <= high):
            warnings.append(f"outside_sanity_range:{low}:{high}")
    return ValidationResult("WARNING" if warnings else "VALID", warnings)
