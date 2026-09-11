import assert from "node:assert/strict";
import { test } from "node:test";
import { MacroService } from "../_shared/service";
import { regime } from "../_shared/analytics";
import { fixtureDataset } from "./fixtures";
import type { Observation } from "../_shared/types";

test("missing observations stay N/A while observed zero remains available", () => {
  const service = new MacroService(fixtureDataset());
  const historical = service.countrySnapshot("CAN", "2023-Q1");
  assert.equal(historical.metrics.gdp_growth.value, 0);
  assert.equal(historical.metrics.gov_10y.value, null);
  assert.equal(service.countrySnapshot("NPL").coverage_score, 0);
  assert.equal(service.countrySnapshot("NPL").regime, "UNCLASSIFIED");
});

test("real policy rate, historical percentile and regime preserve v1 methodology", () => {
  const snapshot = new MacroService(fixtureDataset()).countrySnapshot("CAN");
  assert.equal(snapshot.metrics.real_policy_rate.value, 3);
  assert.equal(snapshot.metrics.gdp_growth.percentile, 75);
  assert.equal(snapshot.regime, "EXPANSION");
});

test("time machine exposes canonical quarters and never reads observations after the cutoff", () => {
  const data = fixtureDataset();
  data.observations.push(obs(20, "inflation", "2023-Q3", "2023-09-30", 99));
  const service = new MacroService(data);
  assert.deepEqual(service.availablePeriods(), ["2023-Q1", "2023-Q2", "2023-Q3"]);
  const snapshot = service.countrySnapshot("CAN", "2023-Q2");
  assert.equal(snapshot.metrics.inflation.value, 2);
  assert.equal(snapshot.metrics.real_policy_rate.value, 3);
});

test("percentiles use only the trailing ten years", () => {
  const data = fixtureDataset();
  data.observations.push(obs(21, "gdp_growth", "2000", "2000-12-31", 100));
  const snapshot = new MacroService(data).countrySnapshot("CAN");
  assert.equal(snapshot.metrics.gdp_growth.percentile, 75);
  assert.equal(snapshot.metrics.gdp_growth.history.some((row: any) => row.period === "2000"), false);
});

test("real rate aligns inflation at or before the policy observation date", () => {
  const data = fixtureDataset();
  data.observations.push(obs(22, "inflation", "2023-Q3", "2023-09-30", 10));
  const real = new MacroService(data).countrySnapshot("CAN").metrics.real_policy_rate;
  assert.equal(real.value, 3);
  assert.equal(real.observation_date, "2023-06-30");
});

test("universe excludes non-analytical catalog entities", () => {
  const service = new MacroService(fixtureDataset());
  assert.deepEqual(service.universe().map((country) => country.code), ["CAN"]);
});

test("coverage is derived from valid metric availability and compare preserves partial N/A", () => {
  const data = fixtureDataset();
  data.countries.push({ code: "NPL", name: "Nepal", region: "Asia", subregion: "Southern Asia", lat: 28, lon: 84,
    gdp_weight: null, tier: 3, is_core: false, coverage_score: 0, data_status: "UNAVAILABLE" });
  const service = new MacroService(data);
  assert.equal(service.countrySnapshot("CAN").coverage_score, 50);
  assert.equal(service.countrySnapshot("NPL").coverage_score, 0);
  const comparison = service.compare("CAN", "NPL");
  assert.equal(comparison.rows.find((row) => row.indicator === "gdp_growth")?.spread, null);
});

test("exact median boundaries resolve consistently to the lower regime side", () => {
  assert.equal(regime(50, 50), "SLOWDOWN");
  assert.equal(regime(51, 50), "EXPANSION");
  assert.equal(regime(50, 51), "STAGFLATION");
});

function obs(id: number, indicator_id: string, period: string, observation_date: string, value: number): Observation {
  return { id, country_code: "CAN", indicator_id, period, observation_date, value, source: "TEST_OFFICIAL",
    source_series_id: indicator_id, retrieved_at: "2024-01-01T00:00:00Z", vintage_at: "2024-01-01T00:00:00Z",
    vintage_date: "2024-01-01", source_vintage_date: "2024-01-01", validation_status: "VALID",
    validation_warnings: [], source_metadata: {} };
}
