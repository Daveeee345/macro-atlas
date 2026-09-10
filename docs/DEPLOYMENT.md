# Netlify + Supabase deployment

Production uses Netlify for the Next.js application and serverless functions, and Supabase PostgreSQL for durable data. The Python/FastAPI and SQLite implementation remains a local reference only.

## 1. Create and migrate Supabase

1. Create a Supabase project.
2. Open **SQL Editor** and run every file in `supabase/migrations/` in filename order. The initial migration creates the catalog, analytical countries, indicators, immutable observation vintages, derived metrics, lineage, sync-run audit records, indexes, and the `current_observations` view.
3. In **Connect**, select **Transaction pooler**. Copy the port `6543` URI and keep `sslmode=require` in the URI.
4. From `frontend/`, copy `.env.example` to `.env`, set `SUPABASE_DATABASE_URL`, install packages, and seed reference metadata:

   ```bash
   cd frontend
   cp .env.example .env
   npm install
   npm run db:seed-reference
   ```

The seed command is idempotent. It loads all 253 geographic catalog records, the eight core analytical economies, and the seven observed indicators. It does not load synthetic observations.

## 2. Configure reviewed official series

Set `MACRO_ATLAS_SERIES_CONFIG` to a JSON array. Each mapping must be reviewed for economic definition, unit, frequency, seasonal adjustment, transformation, release convention, and redistribution rights.

```json
[
  {
    "provider": "WORLDBANK",
    "country": "IDN",
    "indicator": "debt_gdp",
    "seriesId": "REPLACE_WITH_REVIEWED_ID",
    "frequency": "annual",
    "transform": "identity"
  },
  {
    "provider": "FRED",
    "country": "USA",
    "indicator": "inflation",
    "seriesId": "REPLACE_WITH_REVIEWED_ID",
    "frequency": "monthly",
    "units": "pc1",
    "observationStart": "2000-01-01"
  }
]
```

Supported providers are `FRED` and `WORLDBANK`. Supported target frequencies are `daily`, `monthly`, `quarterly`, and `annual`. `transform` accepts `identity` or `yoy_pct`. Prefer reviewed provider-side transformations such as FRED `units` when available.

An empty mapping array is a recorded `NOOP`; it never creates fallback values.

## 3. Create the Netlify site

1. Import the repository in Netlify.
2. Keep the repository root as the configuration location. `netlify.toml` sets `frontend` as the build base, `npm run build`, `.next` as the publish directory, and `frontend/netlify/functions` as the Functions directory relative to that base.
3. Add the variables below under **Project configuration → Environment variables**. Scope database and sync secrets to Functions and Builds as needed.
4. Deploy the production branch.
5. Confirm `/health`, `/api/system/status`, and `/api/periods` respond. In the Functions page, confirm `sync-scheduled` has the Scheduled badge.

Netlify's Next.js runtime handles the App Router build. `/api/*` is rewritten to the `api` function; the browser therefore uses same-origin calls and needs no public API hostname.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_DATABASE_URL` | Yes | Supabase Transaction Pooler URI with SSL; server-side only. |
| `MACRO_ATLAS_SYNC_TOKEN` | Yes | Long random bearer secret used to dispatch the protected background function. |
| `MACRO_ATLAS_SERIES_CONFIG` | Yes | JSON array of reviewed official-series mappings; `[]` is safe but performs no ingestion. |
| `FRED_API_KEY` | For FRED mappings | Server-side FRED credential. |
| `NEXT_PUBLIC_API_BASE` | No | Leave blank for Netlify. Optional only for local FastAPI comparison. |

Never expose `SUPABASE_DATABASE_URL`, the database password, or `MACRO_ATLAS_SYNC_TOKEN` through a `NEXT_PUBLIC_` variable. Do not commit `.env` or `frontend/.env`.

## Scheduled and background synchronization

`sync-scheduled` runs at minute 17 every six hours in UTC, as configured in `netlify.toml`. It does no provider work itself. It sends an authenticated request to `sync-background`, which explicitly exports `background: true` and can run independently of the scheduled function's shorter limit.

The background workflow:

1. parses and validates the approved registry;
2. verifies referenced countries and indicators exist;
3. fetches FRED or World Bank observations;
4. normalizes periods and applies an explicitly configured transformation;
5. skips missing provider values;
6. applies sanity-range validation;
7. skips unchanged values;
8. inserts changed values as new timestamped vintages;
9. records provider lineage and the sync-run result;
10. refreshes stored coverage metadata.

The API reads `current_observations`, while lineage exposes all revisions for the latest period. Older vintages remain immutable.

Scheduled functions execute only on published deploys. For local verification:

```bash
cd frontend
npx netlify dev
npx netlify functions:invoke sync-scheduled
```

## Local reference backend

The FastAPI application can still be run for regression comparison:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload --port 8000
```

Set `NEXT_PUBLIC_API_BASE=http://localhost:8000` only for that reference mode. This path uses the bundled SQLite file and must not be used for production.

## Verification

```bash
cd frontend
npm run typecheck
npm run test:unit
npm run build
```

Integration against a real Supabase project additionally requires applying the migration and running `npm run db:seed-reference` with its transaction-pooler URI.
