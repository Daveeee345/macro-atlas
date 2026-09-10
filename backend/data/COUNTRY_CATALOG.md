# Country universe metadata

Geographic names, ISO identifiers, coordinates, regions and subregions are a
local extract of https://github.com/mledoze/countries/blob/master/countries.json,
retrieved 2026-09-11. The source database is provided under ODbL 1.0; its license
is included in COUNTRY_CATALOG_LICENSE.txt. This adapted metadata database is
provided under the same license. No macroeconomic observations were imported.

The product adds eight core entries (including the non-ISO Euro Area aggregate),
42 extended entries, and a global tier for remaining entities. The catalog
includes countries, territories, an aggregate and disputed geographic units;
its total must not be described as a count of sovereign states. Natural Earth's
Somaliland and Northern Cyprus features receive explicitly non-ISO local codes.

Groups are explicit product filters, not economic classifications. G7/G20 filters
include national members only; the EU and African Union aggregates are not mapped.
Euro Area is not interchangeable with the European Union. ASEAN includes Timor-Leste.
Membership references: https://www.g20.org.za/overview/ and
https://asean.org/forging-a-new-era-timor-leste-admitted-into-asean/.
Developed/emerging classifications are deliberately not inferred.

`country_catalog` is additive to the existing SQLite schema. Initialization
upserts metadata only. Existing country/observation/vintage rows are untouched.
To connect a new economy, add its catalog code to the existing analytical countries
table, then ingest verified observations through the existing repository.

Coverage uses eight required indicators: growth, CPI, policy rate, derived real
rate, ten-year government yield, current account, debt/GDP and credit growth.
Valid non-null latest observations at or before the requested period count;
real rate requires valid policy and inflation inputs. Zero is a real observation.
Coverage does not certify official provenance, freshness or economic strength.
The bundled core observations are synthetic and remain labeled as such.

Endpoints:
- `/api/countries`: unchanged analytical-country default, plus coverage metadata.
- `/api/countries?universe=all`: full catalog and snapshots.
- `/api/universe`: same full catalog; filters `universe`, `tier`, `region`,
  `coverage_min`, `period` are supported.
- `/api/coverage?period=2020-Q2`: aggregate availability and tier counts.
- `/api/countries/NPL`: explicit empty snapshot if no observations exist.

This change preserves the existing latest-at-or-before-period semantics and does
not introduce release-date/vintage reconstruction or repair the engine's existing
cross-series historical alignment. Coverage is availability, not vintage safety.
