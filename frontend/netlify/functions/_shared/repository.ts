import { createHash } from "node:crypto";
import { database, type Queryable } from "./db";
import { MacroService } from "./service";
import type { Dataset, NormalizedObservation, Observation } from "./types";

const DATASET_CACHE_MS = 30_000;
let cachedDataset: Dataset | undefined;
let cachedDatasetAt = 0;
let datasetInFlight: Promise<Dataset> | undefined;

export class PostgresRepository {
  constructor(private readonly db: Queryable = database()) {}

  async dataset(): Promise<Dataset> {
    if (cachedDataset && Date.now() - cachedDatasetAt < DATASET_CACHE_MS) return cachedDataset;
    if (!datasetInFlight) datasetInFlight = this.loadDataset();
    try {
      cachedDataset = await datasetInFlight;
      cachedDatasetAt = Date.now();
      return cachedDataset;
    } finally {
      datasetInFlight = undefined;
    }
  }

  private async loadDataset(): Promise<Dataset> {
    const [payload] = await this.db.query<any>(`select
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.code), '[]'::jsonb)
        from (select code, name, iso2, iso3, numeric_code, geographic_region, subregion,
          tier, is_core, groups, entity_type, lat, lon, metadata from public.country_catalog) row) as catalog,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.name), '[]'::jsonb)
        from (select code, name, region, subregion, lat, lon, gdp_weight, tier, is_core,
          coverage_score, data_status from public.countries) row) as countries,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.id), '[]'::jsonb)
        from (select id, name, category, unit, frequency, transformation, description,
          methodology_version from public.indicators) row) as indicators,
      (select coalesce(jsonb_agg(to_jsonb(row) order by row.country_code, row.indicator_id, row.observation_date, row.period), '[]'::jsonb)
        from (select id, country_code, indicator_id, period, observation_date::text,
          value, source, source_series_id, retrieved_at::text, vintage_at::text,
          coalesce(source_vintage_date::text, vintage_at::date::text) as vintage_date,
          source_vintage_date::text, validation_status, validation_warnings, source_metadata
          from public.current_observations) row) as observations`);
    const catalogRows: any[] = payload?.catalog || [];
    const countries: any[] = payload?.countries || [];
    const indicators: any[] = payload?.indicators || [];
    const observations: any[] = payload?.observations || [];
    return {
      catalog: catalogRows.map((row) => ({ ...row.metadata, ...row, metadata: undefined })),
      countries: countries.map(numericRow),
      indicators,
      observations: observations.map(observationRow),
    };
  }

  async lineage(code: string, indicatorId: string) {
    const latest = (await this.db.query<any>(`select o.*, o.observation_date::text,
      o.retrieved_at::text, o.vintage_at::text,
      coalesce(o.source_vintage_date::text, o.vintage_at::date::text) as vintage_date
      from public.current_observations o
      where o.country_code = $1 and o.indicator_id = $2
      order by o.observation_date desc, o.period desc limit 1`, [code, indicatorId]))[0];
    if (!latest) return null;
    const [country, indicator, revisions, lineage] = await Promise.all([
      this.db.query<any>("select * from public.countries where code = $1", [code]),
      this.db.query<any>("select * from public.indicators where id = $1", [indicatorId]),
      this.db.query<any>(`select id, value, source, retrieved_at::text, vintage_at::text,
        coalesce(source_vintage_date::text, vintage_at::date::text) as vintage_date,
        validation_status, validation_warnings from public.observations
        where country_code = $1 and indicator_id = $2 and period = $3
        order by vintage_at desc, id desc`, [code, indicatorId, latest.period]),
      this.db.query<any>(`select provider, provider_url, transformation, recorded_at::text
        from public.data_lineage where observation_id = $1 order by recorded_at desc`, [latest.id]),
    ]);
    return {
      country: country[0] ? numericRow(country[0]) : null,
      indicator: indicator[0] || null,
      observation: observationRow(latest),
      revisions,
      lineage,
    };
  }

  async systemStatus() {
    const [stats] = await this.db.query<any>(`select
      (select count(*)::int from public.countries) as countries,
      (select count(distinct country_code || ':' || indicator_id)::int from public.current_observations) as series,
      (select count(*)::int from public.observations) as observations,
      (select count(distinct country_code)::int from public.current_observations) as economies_with_observations,
      (select count(*)::int from public.current_observations where validation_status <> 'VALID') as validation_warnings,
      (select max(retrieved_at)::text from public.observations) as last_sync,
      (select max(period) from public.current_observations) as latest_period,
      (select max(completed_at)::text from public.sync_runs where status in ('SUCCEEDED','PARTIAL')) as last_completed_sync,
      (select coalesce(jsonb_agg(to_jsonb(p) order by p.source), '[]'::jsonb) from (
        select source, count(*)::int observations, count(distinct country_code)::int countries,
          count(distinct indicator_id)::int series from public.current_observations group by source
      ) p) as providers`);
    return stats;
  }

  async startSync(source: string): Promise<string> {
    const [row] = await this.db.query<any>(`insert into public.sync_runs(source, status)
      values ($1, 'RUNNING') returning id::text`, [source]);
    return row.id;
  }

  async finishSync(id: string, result: {
    status: "SUCCEEDED" | "PARTIAL" | "FAILED" | "NOOP";
    checkedSeries: number;
    insertedRows: number;
    skippedRows: number;
    failedSeries: number;
    message: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(`update public.sync_runs set completed_at = now(), status = $2,
      checked_series = $3, inserted_rows = $4, skipped_rows = $5, failed_series = $6,
      message = $7, details = $8::jsonb where id = $1::uuid`, [id, result.status,
      result.checkedSeries, result.insertedRows, result.skippedRows, result.failedSeries,
      result.message, result.details || {}]);
  }

  async assertMapping(country: string, indicator: string): Promise<void> {
    const rows = await this.db.query<any>(`select
      exists(select 1 from public.countries where code = $1) as country_exists,
      exists(select 1 from public.indicators where id = $2) as indicator_exists`, [country, indicator]);
    if (!rows[0]?.country_exists) throw new Error(`Country ${country} is not seeded`);
    if (!rows[0]?.indicator_exists) throw new Error(`Indicator ${indicator} is not seeded`);
  }

  async analyticalCountryCodes(): Promise<string[]> {
    const rows = await this.db.query<{ code: string }>("select code from public.countries order by code");
    return rows.map((row) => row.code);
  }

  async bulkUpsertObservations(rows: NormalizedObservation[]): Promise<number> {
    if (!rows.length) return 0;
    const [result] = await this.db.query<{ inserted: number }>(`with incoming as (
      select * from jsonb_to_recordset($1::jsonb) as x(
        country_code text, indicator_id text, period text, observation_date date, value double precision,
        source text, source_series_id text, retrieved_at timestamptz, vintage_at timestamptz,
        source_vintage_date date, validation_status text, validation_warnings text[], source_metadata jsonb)
    ), inserted as (
      insert into public.observations(country_code, indicator_id, period, observation_date, value, source,
        source_series_id, retrieved_at, vintage_at, source_vintage_date, validation_status,
        validation_warnings, source_metadata)
      select i.country_code, i.indicator_id, i.period, i.observation_date, i.value, i.source,
        i.source_series_id, i.retrieved_at, i.vintage_at, i.source_vintage_date, i.validation_status,
        i.validation_warnings, i.source_metadata
      from incoming i
      where not exists (
        select 1 from public.current_observations current
        where current.country_code = i.country_code and current.indicator_id = i.indicator_id
          and current.period = i.period and current.value = i.value
          and current.validation_status = i.validation_status)
      on conflict(country_code, indicator_id, period, vintage_at) do nothing
      returning id, country_code, indicator_id, period
    ), lineage as (
      insert into public.data_lineage(observation_id, provider, provider_url, source_payload, transformation)
      select inserted.id, incoming.source, incoming.source_metadata->>'provider_url',
        incoming.source_metadata, incoming.source_metadata->>'transformation'
      from inserted join incoming using(country_code, indicator_id, period)
      returning id
    ) select count(*)::int as inserted from inserted`, [rows]);
    const inserted = Number(result?.inserted || 0);
    if (inserted) invalidateDatasetCache();
    return inserted;
  }

  async upsertObservation(row: NormalizedObservation): Promise<boolean> {
    const [current] = await this.db.query<any>(`select value, validation_status from public.current_observations
      where country_code = $1 and indicator_id = $2 and period = $3`,
    [row.country_code, row.indicator_id, row.period]);
    if (current && Number(current.value) === row.value && current.validation_status === row.validation_status) {
      return false;
    }
    const inserted = await this.db.query<any>(`insert into public.observations(
      country_code, indicator_id, period, observation_date, value, source, source_series_id,
      retrieved_at, vintage_at, source_vintage_date, validation_status, validation_warnings, source_metadata
    ) values ($1,$2,$3,$4::date,$5,$6,$7,$8::timestamptz,$9::timestamptz,$10::date,$11,$12::text[],$13::jsonb)
    on conflict (country_code, indicator_id, period, vintage_at) do nothing returning id`, [
      row.country_code, row.indicator_id, row.period, row.observation_date, row.value,
      row.source, row.source_series_id, row.retrieved_at, row.vintage_at,
      row.source_vintage_date, row.validation_status, row.validation_warnings,
      row.source_metadata,
    ]);
    if (!inserted[0]) return false;
    await this.db.query(`insert into public.data_lineage(
      observation_id, provider, provider_url, source_payload, transformation
    ) values ($1,$2,$3,$4::jsonb,$5)`, [inserted[0].id, row.source,
      String(row.source_metadata.provider_url || ""), row.source_metadata,
      String(row.source_metadata.transformation || "identity")]);
    invalidateDatasetCache();
    return true;
  }

  async refreshCoverage(): Promise<void> {
    await this.db.query(`with valid as (
      select country_code, count(distinct indicator_id)::int as raw_count,
        bool_or(indicator_id = 'policy_rate') as has_policy,
        bool_or(indicator_id = 'inflation') as has_inflation
      from public.current_observations where validation_status = 'VALID'
        and indicator_id in ('gdp_growth','inflation','policy_rate','gov_10y','current_account','debt_gdp','private_credit_gdp')
      group by country_code
    ), scores as (
      select c.code, coalesce(v.raw_count, 0) + case when coalesce(v.has_policy, false) and coalesce(v.has_inflation, false) then 1 else 0 end as available
      from public.countries c left join valid v on v.country_code = c.code
    ) update public.countries c set coverage_score = round(least(8, scores.available) * 100.0 / 8, 1),
      updated_at = now() from scores where c.code = scores.code`);
    await this.db.query(`update public.countries set data_status = case
      when coverage_score >= 90 then 'FULL'
      when coverage_score >= 70 then 'GOOD'
      when coverage_score >= 50 then 'PARTIAL'
      when coverage_score > 0 then 'LIMITED'
      else 'UNAVAILABLE' end`);
  }

  async refreshDerivedMetrics(): Promise<void> {
    const dataset = await this.dataset();
    const service = new MacroService(dataset);
    const derived: Array<Record<string, unknown>> = [];
    for (const country of dataset.countries) {
      const snapshot = service.countrySnapshot(country.code);
      const period = snapshot.latest_period;
      if (!period) continue;
      const inputs = dataset.observations.filter((row) => row.country_code === country.code && row.period <= period).map((row) => row.id).sort((a, b) => a - b);
      const fingerprint = createHash("sha256").update(inputs.join(",")).digest("hex");
      const values = [
        ["real_policy_rate", snapshot.metrics.real_policy_rate.value, null],
        ["growth_percentile", snapshot.metrics.gdp_growth.percentile, null],
        ["inflation_percentile", snapshot.metrics.inflation.percentile, null],
        ["macro_regime", null, snapshot.regime],
      ];
      for (const [metric, value, valueText] of values) {
        derived.push({ country_code: country.code, metric_id: metric, period, value,
          value_text: valueText, input_observation_ids: inputs, input_fingerprint: fingerprint });
      }
    }
    if (!derived.length) return;
    await this.db.query(`insert into public.derived_metrics(
      country_code, metric_id, period, value, value_text, methodology_version,
      input_observation_ids, input_fingerprint, validation_status
    ) select x.country_code, x.metric_id, x.period, x.value, x.value_text, 'v1',
      x.input_observation_ids, x.input_fingerprint, 'VALID'
      from jsonb_to_recordset($1::jsonb) as x(country_code text, metric_id text, period text,
        value double precision, value_text text, input_observation_ids bigint[], input_fingerprint text)
      on conflict do nothing`, [derived]);
  }
}

function invalidateDatasetCache(): void {
  cachedDataset = undefined;
  cachedDatasetAt = 0;
  datasetInFlight = undefined;
}

function numericRow<T extends Record<string, any>>(row: T): T {
  return { ...row,
    lat: Number(row.lat), lon: Number(row.lon),
    gdp_weight: row.gdp_weight == null ? null : Number(row.gdp_weight),
    coverage_score: row.coverage_score == null ? 0 : Number(row.coverage_score),
  };
}

function observationRow(row: any): Observation {
  return { ...row, id: Number(row.id), value: Number(row.value) };
}
