from pathlib import Path
import json
import pytest
from app.coverage import coverage, REQUIRED_INDICATORS
from app.storage.repository import Repository
from app.service import MacroService
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def service(tmp_path):
    repo = Repository(tmp_path / "universe.db")
    with repo.connect() as conn:
        conn.execute("INSERT INTO countries VALUES ('CAN','Canada','North America',60,-95,1)")
        for indicator in REQUIRED_INDICATORS:
            if indicator != "real_policy_rate":
                conn.execute("INSERT INTO indicators(id,name,category,unit,frequency) VALUES (?,?, 'test','%','Quarterly')", (indicator, indicator))
    def insert(indicator, value, period="2020-Q1", validation="VALID"):
        repo.upsert_observation(dict(country_code="CAN",indicator_id=indicator,period=period,
             observation_date="2020-03-31" if period=="2020-Q1" else "2021-03-31",value=value,
             source="TEST_FIXTURE",retrieved_at="2021-04-01",vintage_date=period,validation_status=validation))
    return MacroService(repo), insert


def test_zero_is_available_but_missing_is_not(service):
    svc, insert = service
    insert("gdp_growth", 0)
    c = svc.country_snapshot("CAN", "2020-Q1")
    assert c["tier"] == 2
    assert c["available_indicator_count"] == 1
    assert c["coverage_score"] == 12.5
    assert c["data_status"] == "LIMITED"
    assert c["metrics"]["inflation"]["value"] is None
    assert c["regime"] == "UNCLASSIFIED"
    assert svc.policy_map() == []
    assert svc.regime_map() == []


def test_coverage_is_period_aware_and_excludes_invalid(service):
    svc, insert = service
    insert("gdp_growth", 0)
    insert("inflation", 2, "2021-Q1")
    insert("policy_rate", 3, "2021-Q1")
    insert("gov_10y", 4, "2021-Q1", "INVALID")
    assert svc.country_snapshot("CAN", "2019-Q4")["coverage_score"] == 0
    assert svc.country_snapshot("CAN", "2020-Q1")["coverage_score"] == 12.5
    c = svc.country_snapshot("CAN", "2021-Q1")
    assert c["coverage_score"] == 50
    assert c["available_indicator_count"] == 4
    assert "gov_10y" in c["unavailable_indicators"]
    assert c["metrics"]["real_policy_rate"]["value"] == 1


def test_full_coverage_is_computed(service):
    svc, insert = service
    for indicator in REQUIRED_INDICATORS:
        if indicator != "real_policy_rate":
            insert(indicator, 1)
    assert svc.country_snapshot("CAN")["coverage_score"] == 100
    assert svc.country_snapshot("CAN")["data_status"] == "FULL"
    insert("inflation", 2, "2021-Q1", "INVALID")
    # An invalid input also disqualifies the derived indicator from coverage.
    assert svc.country_snapshot("CAN")["coverage_score"] == 75


def test_geography_does_not_create_observations(service):
    svc, _ = service
    n = svc.country_snapshot("NPL")
    assert n["coverage_score"] == 0
    assert n["regime"] == "UNCLASSIFIED"
    assert all(m["value"] is None and m["percentile"] is None and m["history"] == [] for m in n["metrics"].values())
    with svc.repo.connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM observations").fetchone()[0] == 0
    assert all(row["spread"] is None for row in svc.compare("CAN","NPL")["rows"])


def test_filters_and_summary(service):
    svc, insert = service
    insert("gdp_growth",0)
    core=svc.universe(universe="core")
    assert {c["code"] for c in core} == {"IDN","USA","CHN","JPN","IND","EUR","GBR","BRA"}
    assert all(c["tier"] == 2 for c in svc.universe(tier=2))
    assert "IDN" in {c["code"] for c in svc.universe(universe="asean")}
    assert "USA" in {c["code"] for c in svc.universe(region="Americas")}
    assert {c["code"] for c in svc.universe(coverage_min=1)} == {"CAN"}
    summary = svc.coverage_summary()
    assert summary["analytical_economies"] == 1
    assert sum(summary["distribution"].values()) == summary["total_economies"]
    assert sum(summary["tiers"].values()) == summary["total_economies"]


def test_api_backward_compatibility_and_filters():
    client=TestClient(app)
    assert len(client.get("/api/countries").json()) == 8
    assert len(client.get("/api/countries?universe=core").json()) == 8
    assert len(client.get("/api/universe").json()) > 190
    assert all(c["tier"]==2 for c in client.get("/api/countries?tier=2").json())
    assert client.get("/api/countries?tier=4").status_code == 422
    assert client.get("/api/countries?coverage_min=101").status_code == 422
    assert client.get("/api/countries/NPL").json()["data_status"] == "UNAVAILABLE"
    assert client.get("/api/countries/NOT_A_COUNTRY").status_code == 404


def test_metadata_initialization_is_idempotent(tmp_path):
    repo=Repository(tmp_path/"catalog.db")
    count=len(repo.catalog())
    repo.initialize()
    assert len(repo.catalog()) == count
