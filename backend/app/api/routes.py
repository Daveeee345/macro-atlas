from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.service import MacroService

router = APIRouter(prefix="/api")
service = MacroService()


@router.get("/countries")
def countries(period: str | None = None, universe: str | None = None,
              tier: int | None = Query(None, ge=1, le=3), region: str | None = None,
              coverage_min: float = Query(0, ge=0, le=100)):
    if universe is not None or tier is not None or region is not None or coverage_min:
        return service.universe(period, universe or "all", tier, region, coverage_min)
    return service.all_snapshots(period)


@router.get("/universe")
def universe(period: str | None = None, universe: str = "all",
             tier: int | None = Query(None, ge=1, le=3), region: str | None = None,
             coverage_min: float = Query(0, ge=0, le=100)):
    return service.universe(period, universe, tier, region, coverage_min)


@router.get("/coverage")
def coverage(period: str | None = None):
    return service.coverage_summary(period)


@router.get("/countries/{code}")
def country(code: str, period: str | None = None):
    try:
        return service.country_snapshot(code.upper(), period)
    except KeyError:
        raise HTTPException(status_code=404, detail="Country not found")


@router.get("/regimes")
def regimes(period: str | None = None):
    return service.regime_map(period)


@router.get("/policy")
def policy(period: str | None = None):
    return service.policy_map(period)


@router.get("/compare")
def compare(left: str = Query("IDN"), right: str = Query("USA"), period: str | None = None):
    try:
        return service.compare(left.upper(), right.upper(), period)
    except KeyError:
        raise HTTPException(status_code=404, detail="Country not found")


@router.get("/periods")
def periods():
    return service.repo.available_periods()


@router.get("/timeline")
def timeline():
    return service.snapshots_by_period()


@router.get("/lineage/{code}/{indicator_id}")
def lineage(code: str, indicator_id: str):
    try:
        return service.lineage(code.upper(), indicator_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Lineage not found")


@router.get("/system/status")
def system_status():
    return service.system_status()
