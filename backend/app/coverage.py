"""Availability metadata only. Never an economic strength or risk score."""
from math import isfinite

REQUIRED_INDICATORS = (
    "gdp_growth", "inflation", "policy_rate", "real_policy_rate",
    "gov_10y", "current_account", "debt_gdp", "credit_growth",
)


def coverage(metrics: dict) -> dict:
    available = []
    for indicator in REQUIRED_INDICATORS:
        metric = metrics.get(indicator, {})
        value = metric.get("value")
        valid = metric.get("validation_status") == "VALID"
        if indicator == "real_policy_rate":
            valid = all(metrics.get(i, {}).get("validation_status") == "VALID"
                        for i in ("policy_rate", "inflation"))
        if value is not None and isfinite(value) and valid:
            available.append(indicator)
    score = round(len(available) / len(REQUIRED_INDICATORS) * 100, 1)
    status = "FULL" if score >= 90 else "GOOD" if score >= 70 else "PARTIAL" if score >= 50 else "LIMITED" if score > 0 else "UNAVAILABLE"
    return {"coverage_score": score, "available_indicator_count": len(available),
            "required_indicator_count": len(REQUIRED_INDICATORS), "data_status": status,
            "available_indicators": available,
            "unavailable_indicators": [i for i in REQUIRED_INDICATORS if i not in available],
            "coverage_method": "Valid, non-null latest available observations at or before the requested period; includes derived real rate. Availability, not freshness or economic strength."}


def matches(country: dict, universe: str = "all", tier: int | None = None,
            region: str | None = None, coverage_min: float = 0) -> bool:
    universe = universe.lower()
    if tier is not None and country.get("tier") != tier:
        return False
    if region and country.get("geographic_region", country.get("region", "")).lower() != region.lower():
        return False
    if country.get("coverage_score", 0) < coverage_min:
        return False
    if universe == "all":
        return True
    if universe == "core":
        return country.get("is_core", False)
    if universe in ("g7", "g20", "asean"):
        return universe.upper() in country.get("groups", [])
    return country.get("geographic_region", country.get("region", "")).lower() == universe
