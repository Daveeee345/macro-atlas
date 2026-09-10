import assert from "node:assert/strict";
import { test } from "node:test";
import { PostgresRepository } from "../_shared/repository";
import type { NormalizedObservation } from "../_shared/types";

test("PostgreSQL repository preserves a changed value as a new vintage", async () => {
  const versions: any[] = [];
  const db = { query: async (text: string, params: any[] = []) => {
    if (text.includes("select value, validation_status")) {
      const matches = versions.filter((row) => row.country === params[0] && row.indicator === params[1] && row.period === params[2]);
      return matches.length ? [{ value: matches.at(-1).value, validation_status: matches.at(-1).status }] : [];
    }
    if (text.includes("insert into public.observations")) {
      versions.push({ country: params[0], indicator: params[1], period: params[2], value: params[4], vintage: params[8], status: params[10] });
      return [{ id: versions.length }];
    }
    return [];
  } };
  const repository = new PostgresRepository(db as any);
  const first = row(1, "2024-01-01T00:00:00Z");
  assert.equal(await repository.upsertObservation(first), true);
  assert.equal(await repository.upsertObservation({ ...first, vintage_at: "2024-01-02T00:00:00Z" }), false);
  assert.equal(await repository.upsertObservation(row(1.5, "2024-02-01T00:00:00Z")), true);
  assert.deepEqual(versions.map((version) => [version.value, version.vintage]), [[1, "2024-01-01T00:00:00Z"], [1.5, "2024-02-01T00:00:00Z"]]);
});

function row(value: number, vintage_at: string): NormalizedObservation {
  return { country_code: "CAN", indicator_id: "gdp_growth", period: "2023-Q4", observation_date: "2023-12-31", value,
    source: "TEST", source_series_id: "TEST", retrieved_at: vintage_at, vintage_at, source_vintage_date: vintage_at.slice(0, 10),
    validation_status: "VALID", validation_warnings: [], source_metadata: {} };
}
