import { coverage, difference, percentileRank, rangeStats, realPolicyRate, regime, REQUIRED_INDICATORS, round } from "./analytics";
import type { CatalogCountry, Country, Dataset, Observation } from "./types";

const CORE_INDICATORS = ["gdp_growth", "inflation", "policy_rate", "gov_10y", "current_account", "debt_gdp", "credit_growth"];

export class MacroService {
  private readonly catalog = new Map<string, CatalogCountry>();
  private readonly countries = new Map<string, Country>();
  private readonly series = new Map<string, Observation[]>();

  constructor(private readonly data: Dataset) {
    data.catalog.forEach((country) => this.catalog.set(country.code, country));
    data.countries.forEach((country) => this.countries.set(country.code, country));
    data.observations.forEach((row) => {
      const key = `${row.country_code}:${row.indicator_id}`;
      const values = this.series.get(key) || [];
      values.push(row);
      this.series.set(key, values);
    });
    this.series.forEach((rows) => rows.sort((a, b) => a.observation_date.localeCompare(b.observation_date) || a.period.localeCompare(b.period)));
  }

  metricSummary(code: string, indicatorId: string, period?: string | null) {
    const series = this.getSeries(code, indicatorId, period);
    if (!series.length) return emptyMetric(indicatorId);
    const latest = series.at(-1)!;
    const previous = series.at(-2);
    const values = series.map((row) => row.value);
    return {
      id: indicatorId,
      value: round(latest.value, 2),
      previous: previous ? round(previous.value, 2) : null,
      delta: previous ? difference(latest.value, previous.value) : null,
      percentile: percentileRank(values, latest.value),
      period: latest.period,
      observation_date: latest.observation_date,
      source: latest.source,
      validation_status: latest.validation_status,
      range: rangeStats(values),
      history: series.slice(-40).map((row) => ({ period: row.period, date: row.observation_date, value: round(row.value, 2) })),
    };
  }

  countrySnapshot(inputCode: string, period?: string | null) {
    const code = inputCode.toUpperCase();
    const catalog = this.catalog.get(code);
    const country = this.countries.get(code);
    if (!catalog && !country) throw new Error("NOT_FOUND");
    const metrics: Record<string, any> = Object.fromEntries(CORE_INDICATORS.map((id) => [id, this.metricSummary(code, id, period)]));
    const policyHistory = this.getSeries(code, "policy_rate", period);
    const inflationHistory = this.getSeries(code, "inflation", period);
    const realHistoryRows = policyHistory.flatMap((policy) => {
      const inflation = inflationHistory.filter((row) => row.observation_date <= policy.observation_date).at(-1);
      const value = realPolicyRate(policy.value, inflation?.value ?? null);
      return value == null ? [] : [{ policy, inflation, value }];
    });
    const realHistory = realHistoryRows.map((row) => row.value);
    const realValue = realPolicyRate(metrics.policy_rate.value, metrics.inflation.value);
    const previous = realHistory.at(-2) ?? null;
    metrics.real_policy_rate = {
      id: "real_policy_rate", value: realValue, previous,
      delta: difference(realValue, previous), percentile: percentileRank(realHistory, realValue),
      period: metrics.policy_rate.period, observation_date: metrics.policy_rate.observation_date,
      source: "Derived: policy rate - inflation", validation_status:
        metrics.policy_rate.validation_status === "VALID" && metrics.inflation.validation_status === "VALID" ? "VALID" : "FAILED",
      range: rangeStats(realHistory),
      history: realHistoryRows.slice(-40).map(({ policy, value }) => ({ period: policy.period, date: policy.observation_date, value })),
    };
    const base = country || {
      code, name: catalog!.name, region: catalog!.geographic_region,
      lat: catalog!.lat, lon: catalog!.lon, gdp_weight: null, tier: catalog!.tier, coverage_score: 0,
    };
    return {
      ...(catalog || {}), ...base,
      geographic_region: catalog?.geographic_region || base.region,
      ...coverage(metrics), country_code: code, country_name: base.name,
      latitude: base.lat, longitude: base.lon, metrics,
      regime: regime(metrics.gdp_growth.percentile, metrics.inflation.percentile),
      latest_period: metrics.gdp_growth.period,
    };
  }

  allSnapshots(period?: string | null) {
    return [...this.countries.keys()].map((code) => this.countrySnapshot(code, period));
  }

  universe(period?: string | null, universe = "all", tier?: number | null, region?: string | null, coverageMin = 0) {
    const snapshots = new Map(this.allSnapshots(period).map((country) => [country.code, country]));
    return [...this.catalog.values()].map((metadata) => snapshots.get(metadata.code) || this.countrySnapshot(metadata.code, period))
      .filter((country) => matches(country, universe, tier, region, coverageMin))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  coverageSummary(period?: string | null) {
    const countries = this.universe(period);
    const statuses = ["FULL", "GOOD", "PARTIAL", "LIMITED", "UNAVAILABLE"];
    return {
      total_economies: countries.length,
      analytical_economies: countries.filter((country) => country.available_indicator_count > 0).length,
      tiers: Object.fromEntries([1, 2, 3].map((tier) => [String(tier), countries.filter((country) => country.tier === tier).length])),
      distribution: Object.fromEntries(statuses.map((status) => [status, countries.filter((country) => country.data_status === status).length])),
      period: period || this.availablePeriods().at(-1) || null,
      required_indicators: [...REQUIRED_INDICATORS],
    };
  }

  regimeMap(period?: string | null) {
    return this.allSnapshots(period).filter((c) => c.metrics.gdp_growth.percentile != null && c.metrics.inflation.percentile != null)
      .map((c) => ({ code: c.code, name: c.name, growth_percentile: c.metrics.gdp_growth.percentile,
        inflation_percentile: c.metrics.inflation.percentile, regime: c.regime, gdp_weight: c.gdp_weight }));
  }

  policyMap(period?: string | null) {
    return this.allSnapshots(period).filter((c) => c.metrics.real_policy_rate.value != null)
      .map((c) => ({ code: c.code, name: c.name, policy_rate: c.metrics.policy_rate.value,
        inflation: c.metrics.inflation.value, real_rate: c.metrics.real_policy_rate.value,
        real_rate_percentile: c.metrics.real_policy_rate.percentile, gdp_weight: c.gdp_weight }))
      .sort((a, b) => b.real_rate - a.real_rate);
  }

  compare(left: string, right: string, period?: string | null) {
    const a = this.countrySnapshot(left, period);
    const b = this.countrySnapshot(right, period);
    const ids = ["gdp_growth", "inflation", "policy_rate", "real_policy_rate", "gov_10y", "current_account", "debt_gdp"];
    return { left: { code: a.code, name: a.name }, right: { code: b.code, name: b.name },
      rows: ids.map((indicator) => ({ indicator, left: a.metrics[indicator], right: b.metrics[indicator],
        spread: difference(a.metrics[indicator].value, b.metrics[indicator].value) })) };
  }

  availablePeriods() {
    return [...new Set(this.data.observations.map((row) => row.period))].sort();
  }

  timeline() {
    return this.availablePeriods().map((period) => ({ period, countries: this.regimeMap(period).map((c) => ({
      code: c.code, growth_percentile: c.growth_percentile, inflation_percentile: c.inflation_percentile, regime: c.regime,
    })) }));
  }

  private getSeries(code: string, indicator: string, period?: string | null) {
    const rows = this.series.get(`${code.toUpperCase()}:${indicator}`) || [];
    if (!period) return rows;
    const cutoff = periodEnd(period);
    return rows.filter((row) => row.observation_date <= cutoff);
  }
}

function periodEnd(period: string): string {
  const quarter = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return new Date(Date.UTC(Number(quarter[1]), Number(quarter[2]) * 3, 0)).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split("-").map(Number);
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }
  if (/^\d{4}$/.test(period)) return `${period}-12-31`;
  return period;
}

function emptyMetric(id: string) {
  return { id, value: null, previous: null, delta: null, percentile: null, period: null, history: [] };
}

function matches(country: any, universe: string, tier?: number | null, region?: string | null, coverageMin = 0) {
  if (tier != null && country.tier !== tier) return false;
  if (region && country.geographic_region.toLowerCase() !== region.toLowerCase()) return false;
  if (country.coverage_score < coverageMin) return false;
  const value = universe.toLowerCase();
  if (value === "all") return true;
  if (value === "core") return country.is_core;
  if (["g7", "g20", "asean"].includes(value)) return country.groups?.includes(value.toUpperCase());
  return country.geographic_region.toLowerCase() === value;
}
