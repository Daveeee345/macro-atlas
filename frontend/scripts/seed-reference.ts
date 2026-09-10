import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const connectionString = process.env.SUPABASE_DATABASE_URL;
if (!connectionString) throw new Error("SUPABASE_DATABASE_URL is required");

const catalogPath = fileURLToPath(new URL("../../backend/data/country_catalog.json", import.meta.url));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const indicators = [
  ["gdp_growth", "Real GDP Growth", "Growth", "% YoY", "Quarterly / source-native", "source-defined annual growth or YoY transformation", "Observed real GDP growth"],
  ["inflation", "Consumer Price Inflation", "Inflation", "% YoY", "Monthly", "year-over-year", "Headline consumer price inflation"],
  ["policy_rate", "Central Bank Policy Rate", "Policy", "%", "Decision-based", "level", "Policy rate"],
  ["gov_10y", "10Y Government Yield", "Rates", "%", "Daily / latest available", "level", "10-year sovereign yield"],
  ["current_account", "Current Account Balance", "External", "% GDP", "Quarterly / Annual", "level", "Current account as share of GDP"],
  ["debt_gdp", "Government Debt", "Fiscal", "% GDP", "Quarterly / Annual", "level", "Government debt as share of GDP"],
  ["credit_growth", "Private Credit Growth", "Credit", "% YoY", "Monthly / Quarterly", "year-over-year", "Private credit growth"],
];
const weights: Record<string, number> = { IDN: 1.4, USA: 4.8, CHN: 3.5, JPN: 2, IND: 2.4, EUR: 3.1, GBR: 1.3, BRA: 1.2 };
const sql = postgres(connectionString, { max: 1, prepare: false, ssl: "require" });

try {
  await sql.begin(async (tx) => {
    await tx.unsafe(`insert into public.country_catalog(
      code,name,iso2,iso3,numeric_code,geographic_region,subregion,tier,is_core,groups,entity_type,lat,lon,metadata
    ) select x.code,x.name,x.iso2,x.iso3,x.numeric_code,x.region,x.subregion,x.tier,x.is_core,x.groups,x.entity_type,x.lat,x.lon,x.metadata
      from jsonb_to_recordset($1::jsonb) as x(code text,name text,iso2 text,iso3 text,numeric_code text,
        region text,subregion text,tier smallint,is_core boolean,groups text[],entity_type text,lat double precision,lon double precision,metadata jsonb)
      on conflict(code) do update set name=excluded.name,iso2=excluded.iso2,iso3=excluded.iso3,numeric_code=excluded.numeric_code,
        geographic_region=excluded.geographic_region,subregion=excluded.subregion,tier=excluded.tier,is_core=excluded.is_core,
        groups=excluded.groups,entity_type=excluded.entity_type,lat=excluded.lat,lon=excluded.lon,metadata=excluded.metadata,updated_at=now()`,
      [JSON.stringify(catalog.map((country: any) => ({ ...country, metadata: country })))]);
    await tx.unsafe(`insert into public.countries(code,name,region,lat,lon,gdp_weight,tier)
      select x.code,x.name,x.region,x.lat,x.lon,x.gdp_weight,x.tier
      from jsonb_to_recordset($1::jsonb) as x(code text,name text,region text,lat double precision,lon double precision,gdp_weight double precision,tier smallint)
      on conflict(code) do update set name=excluded.name,region=excluded.region,lat=excluded.lat,lon=excluded.lon,
        gdp_weight=excluded.gdp_weight,tier=excluded.tier,updated_at=now()`,
      [JSON.stringify(catalog.filter((country: any) => country.is_core).map((country: any) => ({ ...country, gdp_weight: weights[country.code] || null })))]);
    await tx.unsafe(`insert into public.indicators(id,name,category,unit,frequency,transformation,description)
      select * from jsonb_to_recordset($1::jsonb) as x(id text,name text,category text,unit text,frequency text,transformation text,description text)
      on conflict(id) do update set name=excluded.name,category=excluded.category,unit=excluded.unit,frequency=excluded.frequency,
        transformation=excluded.transformation,description=excluded.description,updated_at=now()`,
      [JSON.stringify(indicators.map(([id, name, category, unit, frequency, transformation, description]) => ({ id, name, category, unit, frequency, transformation, description })))]);
  });
  console.log(`Seeded ${catalog.length} catalog entries, ${catalog.filter((country: any) => country.is_core).length} analytical countries, and ${indicators.length} indicators.`);
} finally {
  await sql.end();
}
