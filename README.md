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
- **Official-source connector scaffolds** — FRED and World Bank clients.
- **Reference FastAPI application** — retained for local comparison and methodology history; it is not required in production.

> **Production guardrail:** Netlify Functions never read the bundled SQLite demo database and never synthesize missing observations. An unconfigured production database returns empty/N/A state until reviewed official mappings are synchronized.

## Global country universe

Atlas now supports an additive, tiered geographic catalog with observation-based
coverage, seven analytical layers, universe filters, country focus, zoom/pan and
historical motion. Uncovered economies remain geographically selectable with null
metrics. See [implementation and verification notes](docs/UI_EVOLUTION.md).

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

## Demo timeline

The bottom timeline is functional. Selecting a historical quarter calls period-aware API endpoints and recalculates:

- country metric values,
- historical percentile positions,
- regime assignments,
- real policy rates,
- policy ranking,
- comparison results.

The demo history spans 2016–2026 Q2.

## Methodological guardrails

Macro Atlas deliberately avoids outputs such as:

- “Fed +25 bps causes IHSG −1.2%”
- market forecasts,
- arbitrary crisis scores,
- causal arrows inferred from correlation,
- AI-generated numerical estimates.

Core V1 calculations are deterministic:

```text
Historical percentile = within-series percentile rank
Real policy rate       = policy rate − headline CPI inflation
Country divergence     = Country A − Country B
Macro regime           = growth percentile × inflation percentile
```

See [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md).

## Production data

The repository includes working FRED and World Bank HTTP clients, but production series mappings are intentionally not guessed. Configure only verified series IDs after checking:

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
cd backend
PYTHONPATH=. pytest -q
```

The included tests cover analytics and API behavior, including historical-period snapshots.

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
