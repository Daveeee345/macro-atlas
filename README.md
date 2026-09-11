# MACRO ATLAS

Production: [macro-atlas.netlify.app](https://macro-atlas.netlify.app)

**Global Macro State & Divergence Intelligence**

Macro Atlas is a portfolio-grade macroeconomic intelligence terminal that turns observed macro data into a consistent cross-country analytical interface. It emphasizes **state, historical position, divergence, transparency, and auditability** rather than forecasts or causal claims.

## What is included

- **Atlas** — Natural Earth world map with geographically anchored observations, country selection, optional peer links, and metric inspection.
- **Regimes** — growth × inflation state map using within-country historical percentiles.
- **Policy** — cross-country ex-post real policy rate divergence.
- **Compare** — deterministic country-vs-country macro differences.
- **Country Deep Dive** — macro fingerprint and historical microcharts.
- **Time Machine** — functioning historical period scrubber that recalculates the application state.
- **Data System** — coverage, source architecture, validation and methodology.
- **Data Lineage Drawer** — click metric information icons to inspect the source observation and transformation.
- **Command Palette** — `⌘K` / `Ctrl+K` navigation.
- **Netlify Functions API** — same-origin serverless endpoints backed by Supabase PostgreSQL.
- **Official-source ingestion** — programmatic World Bank WDI coverage plus optional approved FRED mappings.
- **Reference FastAPI application** — retained for local comparison and methodology history; it is not required in production.

> **Production guardrail:** Netlify Functions never read the bundled SQLite demo database and never synthesize missing observations. An unconfigured production database returns empty/N/A state until reviewed official mappings are synchronized.

## Global country universe

Atlas separates 253 geographic/reference entries from 195 analytical economies,
including the Euro Area macro entity. Coverage is observation-based across three
tiers. Uncovered economies remain selectable with null metrics.

## Architecture

```text
Official providers / approved mappings
      │
      ├── FRED connector
      ├── World Bank connector
      └── source-specific adapters
      │
      ▼
Ingestion → Normalization → Validation → Supabase PostgreSQL
                                      │
                                      ▼
                            Deterministic analytics
                       percentile · real rate · regime
                                      │
                                      ▼
                         Netlify Functions API
                                      │
                                      ▼
                              Next.js interface
```

The frontend does not calculate macroeconomic analytics. It only visualizes validated backend outputs.

## Quick start

### 1. Supabase

```bash
# Apply supabase/migrations/*.sql in filename order with the SQL editor.
cd frontend
cp .env.example .env
npm install
npm run db:seed-reference
```

### 2. Full local stack

```bash
cd frontend
npm run dev:netlify
```

Open `http://localhost:8888`. Netlify Dev proxies Next.js and the Functions API from one origin. For UI-only work, `npm run dev` remains available on port 3000.

### 3. Useful routes

```text
/                 Atlas
/regimes          Growth × inflation regimes
/policy           Policy divergence
/compare          Indonesia vs United States
/country/IDN      Indonesia deep dive
/data             Data system & methodology
```

## Observation-state timeline

The bottom timeline is functional. Selecting a historical quarter calls period-aware API endpoints and recalculates:

- country metric values,
- historical percentile positions,
- regime assignments,
- real policy rates,
- policy ranking,
- comparison results.

The API generates canonical quarterly states from actual valid observation dates.
Each state resolves the latest observation at or before quarter end. This is
observation-period playback, not a reconstruction of what was known on that date;
WDI publication lags and later revisions can therefore affect historical states.

## Methodological guardrails

Macro Atlas deliberately avoids outputs such as:

- “Fed +25 bps causes IHSG −1.2%”
- market forecasts,
- arbitrary crisis scores,
- causal arrows inferred from correlation,
- AI-generated numerical estimates.

Core V1 calculations are deterministic:

```text
Historical percentile = empirical rank within the trailing 10 calendar years
Real policy rate       = policy rate − latest inflation dated on/before the policy observation
Country divergence     = Country A − Country B
Macro regime           = growth percentile × inflation percentile
```

See [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

## Production data

Production bulk synchronization uses an allowlisted World Bank WDI registry for
GDP growth, CPI inflation, current-account/GDP, central-government debt/GDP, and
private-credit/GDP. Optional mappings must still be verified for definition,
frequency, units, seasonal adjustment, observation period, revision policy, and
licensing.

Current limitations:

- policy rates remain N/A until current BIS `WS_CBPOL` mappings are verified;
- comparable 10-year sovereign yields remain N/A without approved official mappings;
- WDI availability and publication lag differ by country and indicator;
- values may be revised, with each changed value retained as a new vintage;
- historical states use observation dates rather than release-time information sets.

For any added series, verify:

1. economic definition,
2. frequency,
3. units,
4. seasonal adjustment,
5. observation period,
6. release / revision policy,
7. source licensing.

See [`docs/PRODUCTION_DATA.md`](docs/PRODUCTION_DATA.md).

## Tests

```bash
cd frontend
npm run test:unit
npm run typecheck
npm run lint
npm run build
```

Tests cover canonical quarter generation and playback, cutoff safety, trailing
10-year percentiles, date-aligned real rates, missing values, revision preservation,
API behavior, global sync filtering, and map matching.

## Production stack

- **Frontend:** Netlify Next.js runtime
- **API:** Netlify Functions
- **Database:** Supabase PostgreSQL through the transaction pooler
- **Scheduler:** Netlify Scheduled Function dispatching a Background Function every six hours
- **Monitoring:** API health, stale-series checks, source failures, revision anomalies

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the exact migration, environment, deployment, and synchronization steps.

## Product principle

> **What is the macro state, where is it relative to history, and how does it differ across economies?**

Not: **What will happen next?**
