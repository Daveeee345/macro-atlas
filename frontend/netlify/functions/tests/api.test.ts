import assert from "node:assert/strict";
import { test } from "node:test";
import { handleApi } from "../_shared/api-handler";
import { fixtureDataset } from "./fixtures";

const repository: any = {
  dataset: async () => fixtureDataset(),
  systemStatus: async () => ({ countries: 1, series: 3, observations: 6, validation_warnings: 0, last_sync: "2023-07-01T00:00:00Z", latest_period: "2023-Q2" }),
  lineage: async () => null,
};

test("serverless API returns compatible country and N/A responses", async () => {
  const response = await handleApi(new Request("http://localhost/api/countries/NPL"), repository);
  assert.equal(response.status, 200);
  const body: any = await response.json();
  assert.equal(body.metrics.gdp_growth.value, null);
  assert.equal(body.data_status, "UNAVAILABLE");
});

test("serverless API validates filters and reports production status", async () => {
  assert.equal((await handleApi(new Request("http://localhost/api/countries?tier=4"), repository)).status, 422);
  const status: any = await (await handleApi(new Request("http://localhost/api/system/status"), repository)).json();
  assert.equal(status.mode, "LIVE_OFFICIAL");
  assert.equal(status.storage, undefined);
});
