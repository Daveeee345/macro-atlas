import assert from "node:assert/strict";
import { test } from "node:test";
import { MacroService } from "../_shared/service";
import { fixtureDataset } from "./fixtures";

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
