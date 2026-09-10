export type HistoryPoint = { period: string; date: string; value: number };

export type Metric = {
  id: string;
  value: number | null;
  previous: number | null;
  delta: number | null;
  percentile: number | null;
  period: string | null;
  observation_date?: string | null;
  source?: string | null;
  validation_status?: string;
  range?: { min: number | null; median: number | null; max: number | null };
  history: HistoryPoint[];
};

export type CountrySnapshot = {
  iso2: string | null;
  iso3: string | null;
  numeric_code: string | null;
  geographic_region?: string;
  subregion: string;
  tier: 1 | 2 | 3;
  is_core: boolean;
  groups: string[];
  entity_type: string;
  coverage_score: number;
  available_indicator_count: number;
  required_indicator_count: number;
  data_status: "FULL" | "GOOD" | "PARTIAL" | "LIMITED" | "UNAVAILABLE";
  available_indicators: string[];
  unavailable_indicators: string[];
  coverage_method: string;
  code: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  gdp_weight: number | null;
  metrics: Record<string, Metric>;
  regime: string;
  latest_period: string | null;
};

export type RegimePoint = {
  code: string;
  name: string;
  growth_percentile: number;
  inflation_percentile: number;
  regime: string;
  gdp_weight: number | null;
};

export type PolicyPoint = {
  code: string;
  name: string;
  policy_rate: number;
  inflation: number;
  real_rate: number;
  real_rate_percentile: number | null;
  gdp_weight: number | null;
};

export type CompareRow = {
  indicator: string;
  left: Metric;
  right: Metric;
  spread: number | null;
};

export type CompareResponse = {
  left: { code: string; name: string };
  right: { code: string; name: string };
  rows: CompareRow[];
};

export type SystemStatus = {
  mode: string;
  countries: number;
  series: number;
  observations: number;
  validation_warnings: number;
  last_sync: string | null;
  latest_period: string | null;
  data_label: string;
};
