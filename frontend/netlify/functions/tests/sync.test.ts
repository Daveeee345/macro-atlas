import assert from "node:assert/strict";
import { test } from "node:test";
import { syncOfficialData } from "../_shared/sync";

test("sync skips missing and unchanged rows and records new official observations", async () => {
  const inserted: any[] = [];
  let completion: any;
  const repository: any = {
    startSync: async () => "run-1",
    finishSync: async (_id: string, result: any) => { completion = result; },
    assertMapping: async () => undefined,
    upsertObservation: async (row: any) => { inserted.push(row); return row.value !== 2; },
    refreshCoverage: async () => undefined,
    refreshDerivedMetrics: async () => undefined,
  };
  const result = await syncOfficialData({
    repository,
    mappings: [{ provider: "WORLDBANK", country: "CAN", indicator: "gdp_growth", seriesId: "OFFICIAL.TEST", frequency: "annual" }],
    fetcher: async () => [{ date: "2022", value: null }, { date: "2023", value: 2 }, { date: "2024", value: 2.5 }],
    now: () => new Date("2025-01-10T12:00:00Z"),
  });
  assert.equal(result.insertedRows, 1);
  assert.equal(result.skippedRows, 2);
  assert.equal(inserted.length, 2);
  assert.equal(inserted[0].period, "2023");
  assert.equal(inserted[1].source, "WORLDBANK");
  assert.equal(completion.status, "SUCCEEDED");
});

test("empty mapping configuration is an explicit no-op without synthetic fallback", async () => {
  let status = "";
  const repository: any = { startSync: async () => "run-2", finishSync: async (_id: string, result: any) => { status = result.status; } };
  const result = await syncOfficialData({ repository, mappings: [] });
  assert.equal(result.status, "NOOP");
  assert.equal(status, "NOOP");
});

test("production bulk sync preserves repository-controlled revision semantics", async () => {
  let bulkRows: any[] = [];
  const repository: any = {
    startSync: async () => "run-3",
    finishSync: async () => undefined,
    analyticalCountryCodes: async () => ["CAN"],
    bulkUpsertObservations: async (rows: any[]) => { bulkRows = bulkRows.concat(rows); return rows.length; },
    refreshCoverage: async () => undefined,
    refreshDerivedMetrics: async () => undefined,
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify([{}, [{ countryiso3code: "CAN", date: "2023", value: 1, obs_status: "" },
    { countryiso3code: "USA", date: "2023", value: 2, obs_status: "" },
    { countryiso3code: "CAN", date: "2024", value: 3, obs_status: "F" }]]), { status: 200 });
  try {
    const result = await syncOfficialData({ repository, mappings: [], globalWdi: true, now: () => new Date("2025-01-10T12:00:00Z") });
    assert.equal(result.checkedSeries, 5);
    assert.equal(result.insertedRows, 5);
    assert.equal(bulkRows.length, 5);
    assert.equal(bulkRows.every((row) => row.country_code === "CAN" && row.period === "2023"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
