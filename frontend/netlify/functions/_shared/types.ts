export type ValidationStatus = "VALID" | "WARNING" | "FAILED";

export type CatalogCountry = {
  code: string;
  name: string;
  iso2: string | null;
  iso3: string | null;
  numeric_code: string | null;
  geographic_region: string;
  subregion: string;
  tier: 1 | 2 | 3;
  is_core: boolean;
  groups: string[];
  entity_type: string;
  lat: number;
  lon: number;
  metadata?: Record<string, unknown>;
};

export type Country = {
  code: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  gdp_weight: number | null;
  tier: 1 | 2 | 3;
  coverage_score: number;
};

export type Indicator = {
  id: string;
  name: string;
  category: string;
  unit: string;
  frequency: string;
  transformation: string | null;
  description: string | null;
  methodology_version: string;
};

export type Observation = {
  id: number;
  country_code: string;
  indicator_id: string;
  period: string;
  observation_date: string;
  value: number;
  source: string;
  source_series_id: string | null;
  retrieved_at: string;
  vintage_at: string;
  vintage_date?: string | null;
  source_vintage_date: string | null;
  validation_status: ValidationStatus;
  validation_warnings: string[];
  source_metadata: Record<string, unknown>;
};

export type Dataset = {
  catalog: CatalogCountry[];
  countries: Country[];
  indicators: Indicator[];
  observations: Observation[];
};

export type OfficialSeriesMapping = {
  provider: "FRED" | "WORLDBANK";
  country: string;
  indicator: string;
  seriesId: string;
  frequency: "daily" | "monthly" | "quarterly" | "annual";
  observationStart?: string;
  units?: string;
  transform?: "identity" | "yoy_pct";
};

export type NormalizedObservation = {
  country_code: string;
  indicator_id: string;
  period: string;
  observation_date: string;
  value: number;
  source: string;
  source_series_id: string;
  retrieved_at: string;
  vintage_at: string;
  source_vintage_date: string | null;
  validation_status: ValidationStatus;
  validation_warnings: string[];
  source_metadata: Record<string, unknown>;
};
