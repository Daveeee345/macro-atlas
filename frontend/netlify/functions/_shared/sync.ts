import { PostgresRepository } from "./repository";
import type { NormalizedObservation, OfficialSeriesMapping, ValidationStatus } from "./types";

type RawObservation = { date: string; value: number | null; sourceVintageDate?: string | null; sourcePayload?: Record<string, unknown> };
type SyncRepository = Pick<PostgresRepository, "startSync" | "finishSync" | "assertMapping" | "upsertObservation" | "refreshCoverage" | "refreshDerivedMetrics"> &
  Partial<Pick<PostgresRepository, "analyticalCountryCodes" | "bulkUpsertObservations">>;
type ProviderFetcher = (mapping: OfficialSeriesMapping) => Promise<RawObservation[]>;

const BOUNDS: Record<string, [number, number]> = {
  gdp_growth: [-35, 35], inflation: [-20, 150], policy_rate: [-5, 100], gov_10y: [-5, 100],
  current_account: [-50, 50], debt_gdp: [0, 500], private_credit_gdp: [0, 500],
};

const WDI_REGISTRY = [
  { indicator: "gdp_growth", seriesId: "NY.GDP.MKTP.KD.ZG" },
  { indicator: "inflation", seriesId: "FP.CPI.TOTL.ZG" },
  { indicator: "current_account", seriesId: "BN.CAB.XOKA.GD.ZS" },
  { indicator: "debt_gdp", seriesId: "GC.DOD.TOTL.GD.ZS" },
  { indicator: "private_credit_gdp", seriesId: "FS.AST.PRVT.GD.ZS" },
] as const;

export function mappingsFromEnvironment(raw = process.env.MACRO_ATLAS_SERIES_CONFIG || "[]"): OfficialSeriesMapping[] {
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("MACRO_ATLAS_SERIES_CONFIG must be a JSON array");
  return value.map((item, index) => {
    if (!["FRED", "WORLDBANK"].includes(item.provider) || !item.country || !item.indicator || !item.seriesId ||
      !["daily", "monthly", "quarterly", "annual"].includes(item.frequency)) {
      throw new Error(`Invalid series mapping at index ${index}`);
    }
    return { ...item, country: String(item.country).toUpperCase() } as OfficialSeriesMapping;
  });
}

export async function syncOfficialData(options: {
  repository?: SyncRepository;
  mappings?: OfficialSeriesMapping[];
  fetcher?: ProviderFetcher;
  now?: () => Date;
  globalWdi?: boolean;
} = {}) {
  const repository = options.repository || new PostgresRepository();
  const mappings = options.mappings || mappingsFromEnvironment();
  const fetcher = options.fetcher || fetchOfficialSeries;
  const now = options.now || (() => new Date());
  const runId = await repository.startSync("OFFICIAL_PROVIDERS");
  let insertedRows = 0;
  let skippedRows = 0;
  let failedSeries = 0;
  const failures: Array<{ mapping: string; error: string }> = [];
  const globalWdi = options.globalWdi ?? !options.repository;
  if (globalWdi && repository.analyticalCountryCodes && repository.bulkUpsertObservations) {
    const codes = new Set(await repository.analyticalCountryCodes());
    for (const definition of WDI_REGISTRY) {
      try {
        const rows = await fetchWorldBankGlobal(definition.indicator, definition.seriesId, codes, now());
        const inserted = await repository.bulkUpsertObservations(rows);
        insertedRows += inserted;
        skippedRows += rows.length - inserted;
      } catch (error) {
        failedSeries += 1;
        failures.push({ mapping: `GLOBAL:${definition.indicator}`, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  if (!mappings.length && !globalWdi) {
    const result = { status: "NOOP" as const, checkedSeries: 0, insertedRows: 0, skippedRows: 0, failedSeries: 0,
      message: "No approved official-series mappings configured." };
    await repository.finishSync(runId, result);
    return { runId, ...result };
  }
  for (const mapping of mappings) {
    try {
      await repository.assertMapping(mapping.country, mapping.indicator);
      const rawRows = applyTransform(await fetcher(mapping), mapping);
      const retrievedAt = now().toISOString();
      for (let index = 0; index < rawRows.length; index += 1) {
        const raw = rawRows[index];
        if (raw.value == null || !Number.isFinite(raw.value)) { skippedRows += 1; continue; }
        const validation = validate(mapping.indicator, raw.value);
        const vintageAt = new Date(now().getTime() + index).toISOString();
        const row: NormalizedObservation = {
          country_code: mapping.country, indicator_id: mapping.indicator,
          period: periodFor(raw.date, mapping.frequency), observation_date: observationDate(raw.date, mapping.frequency),
          value: raw.value, source: mapping.provider, source_series_id: mapping.seriesId,
          retrieved_at: retrievedAt, vintage_at: vintageAt,
          source_vintage_date: raw.sourceVintageDate || null,
          validation_status: validation.status, validation_warnings: validation.warnings,
          source_metadata: { ...(raw.sourcePayload || {}), provider_url: providerUrl(mapping), transformation: mapping.transform || "identity" },
        };
        if (await repository.upsertObservation(row)) insertedRows += 1;
        else skippedRows += 1;
      }
    } catch (error) {
      failedSeries += 1;
      failures.push({ mapping: `${mapping.country}:${mapping.indicator}`, error: error instanceof Error ? error.message : String(error) });
    }
  }
  await repository.refreshCoverage();
  await repository.refreshDerivedMetrics();
  const checkedSeries = mappings.length + (globalWdi ? WDI_REGISTRY.length : 0);
  const status = failedSeries === checkedSeries ? "FAILED" : failedSeries ? "PARTIAL" : "SUCCEEDED";
  const result = { status, checkedSeries, insertedRows, skippedRows, failedSeries,
    message: `${insertedRows} new or revised observations stored; ${skippedRows} unchanged or missing rows skipped.`, details: { failures } } as const;
  await repository.finishSync(runId, result);
  return { runId, ...result };
}

async function fetchWorldBankGlobal(indicator: string, seriesId: string, allowedCodes: Set<string>, now: Date): Promise<NormalizedObservation[]> {
  const endYear = now.getUTCFullYear();
  const startYear = endYear - 15;
  const url = new URL(`https://api.worldbank.org/v2/country/all/indicator/${seriesId}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("source", "2");
  url.searchParams.set("date", `${startYear}:${endYear}`);
  url.searchParams.set("per_page", "20000");
  const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`World Bank ${response.status}`);
  const payload = await response.json() as any;
  const rawRows = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
  const retrievedAt = now.toISOString();
  return rawRows.flatMap((item: any): NormalizedObservation[] => {
    const providerCode = String(item.countryiso3code || item.country?.id || "").toUpperCase();
    const code = providerCode === "EMU" ? "EUR" : providerCode;
    const value = item.value == null ? null : Number(item.value);
    if (!allowedCodes.has(code) || value == null || !Number.isFinite(value) || item.obs_status === "F") return [];
    const validation = validate(indicator, value);
    return [{
      country_code: code, indicator_id: indicator, period: String(item.date),
      observation_date: `${item.date}-12-31`, value, source: "WORLDBANK",
      source_series_id: seriesId, retrieved_at: retrievedAt, vintage_at: retrievedAt,
      source_vintage_date: null, validation_status: validation.status,
      validation_warnings: validation.warnings,
      source_metadata: {
        provider_url: `https://data.worldbank.org/indicator/${seriesId}`,
        transformation: "identity",
        provider_country_code: providerCode,
        decimal: item.decimal ?? null,
        observation_status: item.obs_status || null,
      },
    }];
  });
}

export async function fetchOfficialSeries(mapping: OfficialSeriesMapping): Promise<RawObservation[]> {
  if (mapping.provider === "FRED") {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) throw new Error("FRED_API_KEY is required for FRED mappings");
    const url = new URL("https://api.stlouisfed.org/fred/series/observations");
    url.searchParams.set("series_id", mapping.seriesId);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("file_type", "json");
    if (mapping.observationStart) url.searchParams.set("observation_start", mapping.observationStart);
    if (mapping.units) url.searchParams.set("units", mapping.units);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`FRED ${response.status}`);
    const payload = await response.json() as any;
    return (payload.observations || []).map((item: any) => ({
      date: item.date, value: item.value === "." || item.value == null ? null : Number(item.value),
      sourceVintageDate: item.realtime_start || null, sourcePayload: { realtime_end: item.realtime_end || null },
    }));
  }
  const url = new URL(`https://api.worldbank.org/v2/country/${encodeURIComponent(mapping.country)}/indicator/${encodeURIComponent(mapping.seriesId)}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("per_page", "20000");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`World Bank ${response.status}`);
  const payload = await response.json() as any;
  const rows = Array.isArray(payload) && Array.isArray(payload[1]) ? payload[1] : [];
  return rows.map((item: any) => ({ date: String(item.date), value: item.value == null ? null : Number(item.value), sourcePayload: { indicator: item.indicator?.id } }))
    .sort((a: RawObservation, b: RawObservation) => a.date.localeCompare(b.date));
}

function applyTransform(rows: RawObservation[], mapping: OfficialSeriesMapping): RawObservation[] {
  if (!mapping.transform || mapping.transform === "identity") return rows;
  const lag = mapping.frequency === "monthly" ? 12 : mapping.frequency === "quarterly" ? 4 : 1;
  return rows.map((row, index) => {
    const previous = rows[index - lag]?.value;
    return { ...row, value: row.value == null || previous == null || previous === 0 ? null : Math.round(((row.value / previous) - 1) * 10000) / 100 };
  });
}

function periodFor(rawDate: string, frequency: OfficialSeriesMapping["frequency"]): string {
  const date = normalizedDate(rawDate, frequency);
  const year = date.slice(0, 4);
  if (frequency === "annual") return year;
  if (frequency === "quarterly") return `${year}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;
  if (frequency === "monthly") return date.slice(0, 7);
  return date;
}

function observationDate(rawDate: string, frequency: OfficialSeriesMapping["frequency"]): string {
  return normalizedDate(rawDate, frequency);
}

function normalizedDate(rawDate: string, frequency: OfficialSeriesMapping["frequency"]): string {
  if (/^\d{4}$/.test(rawDate)) return `${rawDate}-12-31`;
  if (/^\d{4}-Q[1-4]$/.test(rawDate)) {
    const [year, quarter] = rawDate.split("-Q");
    return `${year}-${String(Number(quarter) * 3).padStart(2, "0")}-01`;
  }
  const parsed = new Date(`${rawDate.length === 7 ? `${rawDate}-01` : rawDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid provider date: ${rawDate}`);
  if (frequency !== "annual") return parsed.toISOString().slice(0, 10);
  return `${parsed.getUTCFullYear()}-12-31`;
}

function validate(indicator: string, value: number): { status: ValidationStatus; warnings: string[] } {
  const bounds = BOUNDS[indicator];
  if (!bounds) return { status: "VALID", warnings: [] };
  const warnings = value < bounds[0] || value > bounds[1] ? [`outside_sanity_range:${bounds[0]}:${bounds[1]}`] : [];
  return { status: warnings.length ? "WARNING" : "VALID", warnings };
}

function providerUrl(mapping: OfficialSeriesMapping): string {
  return mapping.provider === "FRED"
    ? `https://fred.stlouisfed.org/series/${encodeURIComponent(mapping.seriesId)}`
    : `https://data.worldbank.org/indicator/${encodeURIComponent(mapping.seriesId)}`;
}
