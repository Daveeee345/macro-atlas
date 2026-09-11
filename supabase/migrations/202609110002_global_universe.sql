begin;

alter table public.countries add column if not exists subregion text not null default '';
alter table public.countries add column if not exists is_core boolean not null default false;
alter table public.countries add column if not exists data_status text not null default 'UNAVAILABLE'
  check (data_status in ('FULL', 'GOOD', 'PARTIAL', 'LIMITED', 'UNAVAILABLE'));

insert into public.countries(code, name, region, subregion, lat, lon, gdp_weight, tier, is_core, coverage_score, data_status)
select code, name, geographic_region, subregion, lat, lon, null, tier, is_core, 0, 'UNAVAILABLE'
from public.country_catalog
where entity_type = 'country' or code = 'EUR'
on conflict(code) do update set
  name = excluded.name,
  region = excluded.region,
  subregion = excluded.subregion,
  lat = excluded.lat,
  lon = excluded.lon,
  tier = excluded.tier,
  is_core = excluded.is_core,
  updated_at = now();

insert into public.indicators(id, name, category, unit, frequency, transformation, description, methodology_version)
values ('private_credit_gdp', 'Domestic Credit to Private Sector', 'Credit', '% GDP', 'Annual', 'level',
  'Domestic credit to private sector as a share of GDP; World Bank WDI FS.AST.PRVT.GD.ZS.', 'v1')
on conflict(id) do update set
  name = excluded.name,
  category = excluded.category,
  unit = excluded.unit,
  frequency = excluded.frequency,
  transformation = excluded.transformation,
  description = excluded.description,
  methodology_version = excluded.methodology_version,
  updated_at = now();

update public.indicators
set description = 'Legacy identifier retained for compatibility; do not map private-credit-to-GDP data to this growth metric.',
    updated_at = now()
where id = 'credit_growth';

create index if not exists countries_tier_idx on public.countries(tier);
create index if not exists countries_region_idx on public.countries(region);
create index if not exists countries_coverage_idx on public.countries(coverage_score desc);
create index if not exists observations_date_idx
  on public.observations(country_code, indicator_id, observation_date desc, vintage_at desc);

comment on column public.countries.data_status is 'Coverage classification derived from available valid required indicators.';

commit;
