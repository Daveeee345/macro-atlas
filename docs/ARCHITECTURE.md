# Architecture

## Layers

### 1. Ingestion
Provider-specific adapters return normalized observation objects. API-specific logic must stay here.

### 2. Validation
Observations pass missing-value, range and structural checks before publishing.

### 3. Production storage
Supabase PostgreSQL stores reference metadata, immutable observation vintages, derived metric records, lineage, validation state and synchronization runs. `current_observations` selects the latest vintage for each country, indicator and period. SQLite remains only in the reference FastAPI application.

### 4. Analytics
`backend/app/analytics/engine.py` contains deterministic calculations only.

### 5. Service layer
`MacroService` assembles raw and derived state into stable API response objects.

### 6. Netlify Functions
The `api` function exposes country snapshots, regimes, policy divergence, comparison, historical periods, lineage and system status. A scheduled function dispatches the protected background synchronization function.

### 7. Next.js on Netlify
The frontend consumes same-origin `/api` outputs and does not recalculate finance logic. Netlify rewrites those requests to the serverless API.

## Historical mode

All principal endpoints accept a `period` parameter. The UI timeline selects a historical period and refetches the state as known within the demo history up to that period.

## Data lineage

The left metric sidebar exposes an information action. The lineage drawer reads the observation source, period, retrieval time, validation state and methodology from the backend.
