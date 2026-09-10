import { createHash } from "node:crypto";
import { database, type Queryable } from "./db";
import { MacroService } from "./service";
import type { Dataset, NormalizedObservation, Observation } from "./types";

export class PostgresRepository {
  constructor(private readonly db: Queryable = database()) {}

  async dataset(): Promise<Dataset> {
    const [catalogRows, countries, indicators, observations] = await Promise.all([
      this.db.query<any>(`select code, name, iso2, iso3, numeric_code, geographic_region, subregion,
        tier, is_core, groups, entity_type, lat, lon, metadata from public.country_catalog order by code`),
      this.db.query<any>(`select code, name, region, lat, lon, gdp_weight, tier, coverage_score
        from public.countries order by name`),
      this.db.query<any>(`select id, name, category, unit, frequency, transformation, description,
        methodology_version from public.indicators order by id`),
      this.db.query<any>(`select id, country_code, indicator_id, period, observation_date::text,
        value, source, source_series_id, retrieved_at::text, vintage_at::text,
        coalesce(source_vintage_date::text, vintage_at::date::text) as vintage_date,
        source_vintage_date::text, validation_status, validation_warnings, source_metadata
        from public.current_observations order by country_code, indicator_id, observation_date, period`),
    ]);
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
      (select count(*)::int from public.current_observations where validation_status <> 'VALID') as validation_warnings,
      (select max(retrieved_at)::text from public.observations) as last_sync,
      (select max(period) from public.current_observations) as latest_period,
      (select max(completed_at)::text from public.sync_runs where status in ('SUCCEEDED','PARTIAL','NOOP')) as last_completed_sync`);
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
      result.message, JSON.stringify(result.details || {})]);
  }

  async assertMapping(country: string, indicator: string): Promise<void> {
    const rows = await this.db.query<any>(`select
      exists(select 1 from public.countries where code = $1) as country_exists,
      exists(select 1 from public.indicators where id = $2) as indicator_exists`, [country, indicator]);
    if (!rows[0]?.country_exists) throw new Error(`Country ${country} is not seeded`);
    if (!rows[0]?.indicator_exists) throw new Error(`Indicator ${indicator} is not seeded`);
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
      JSON.stringify(row.source_metadata),
    ]);
    if (!inserted[0]) return false;
    await this.db.query(`insert into public.data_lineage(
      observation_id, provider, provider_url, source_payload, transformation
    ) values ($1,$2,$3,$4::jsonb,$5)`, [inserted[0].id, row.source,
      String(row.source_metadata.provider_url || ""), JSON.stringify(row.source_metadata),
      String(row.source_metadata.transformation || "identity")]);
    return true;
  }

  async refreshCoverage(): Promise<void> {
    await this.db.query(`with valid as (
      select country_code, count(distinct indicator_id)::int as raw_count,
        bool_or(indicator_id = 'policy_rate') as has_policy,
        bool_or(indicator_id = 'inflation') as has_inflation
      from public.current_observations where validation_status = 'VALID'
      group by country_code
    ), scores as (
      select c.code, coalesce(v.raw_count, 0) + case when coalesce(v.has_policy, false) and coalesce(v.has_inflation, false) then 1 else 0 end as available
      from public.countries c left join valid v on v.country_code = c.code
    ) update public.countries c set coverage_score = round(least(8, scores.available) * 100.0 / 8, 1),
      updated_at = now() from scores where c.code = scores.code`);
  }

  async refreshDerivedMetrics(): Promise<void> {
    const dataset = await this.dataset();
    const service = new MacroService(dataset);
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
        await this.db.query(`insert into public.derived_metrics(
          country_code, metric_id, period, value, value_text, methodology_version,
          input_observation_ids, input_fingerprint, validation_status
        ) values ($1,$2,$3,$4,$5,'v1',$6::bigint[],$7,'VALID') on conflict do nothing`,
        [country.code, metric, period, value, valueText, inputs, fingerprint]);
      }
    }
  }
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
