import type { Dataset, Observation } from "../_shared/types";

export function fixtureDataset(): Dataset {
  const base = { iso2: "CA", iso3: "CAN", numeric_code: "124", geographic_region: "Americas", subregion: "North America",
    tier: 2 as const, is_core: false, groups: ["G20"], entity_type: "country", lat: 56, lon: -106 };
  const observations: Observation[] = [
    observation(1, "gdp_growth", "2023-Q1", 0),
    observation(2, "gdp_growth", "2023-Q2", 2),
    observation(3, "inflation", "2023-Q1", 3),
    observation(4, "inflation", "2023-Q2", 2),
    observation(5, "policy_rate", "2023-Q1", 4),
    observation(6, "policy_rate", "2023-Q2", 5),
  ];
  return {
    catalog: [{ ...base, code: "CAN", name: "Canada" }, { ...base, code: "NPL", name: "Nepal", iso2: "NP", iso3: "NPL", numeric_code: "524", geographic_region: "Asia", subregion: "Southern Asia", lat: 28, lon: 84 }],
    countries: [{ code: "CAN", name: "Canada", region: "Americas", subregion: "North America", lat: 56, lon: -106,
      gdp_weight: 1, tier: 2, is_core: false, coverage_score: 0, data_status: "UNAVAILABLE" }],
    indicators: ["gdp_growth", "inflation", "policy_rate"].map((id) => ({ id, name: id, category: "test", unit: "%", frequency: "Quarterly", transformation: "level", description: null, methodology_version: "v1" })),
    observations,
  };
}

function observation(id: number, indicator_id: string, period: string, value: number): Observation {
  return { id, country_code: "CAN", indicator_id, period, observation_date: period.endsWith("Q1") ? "2023-03-31" : "2023-06-30",
    value, source: "TEST_OFFICIAL", source_series_id: indicator_id, retrieved_at: "2023-07-01T00:00:00Z",
    vintage_at: "2023-07-01T00:00:00Z", vintage_date: "2023-07-01", source_vintage_date: "2023-07-01",
    validation_status: "VALID", validation_warnings: [], source_metadata: {} };
}
