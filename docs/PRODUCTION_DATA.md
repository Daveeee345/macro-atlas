# Production Data Integration

The bundled dataset is synthetic demo data. This document describes the path to production data.

## Provider adapters

### FRED

Production uses `frontend/netlify/functions/_shared/sync.ts`. The original Python adapters remain as readable references.

Supports the FRED series-observations endpoint and accepts:

- series ID,
- observation start,
- unit transformation,
- frequency aggregation.

FRED requires an API key.

### World Bank

The serverless World Bank adapter uses the same V2 Indicators API and does not require an API key.

Uses the World Bank V2 Indicators API and does not require an API key.

## Do not guess series IDs

For each country × indicator, approve a mapping only after validating:

```text
1. Indicator economic definition
2. Provider / official source
3. Series ID
4. Native frequency
5. Unit
6. Seasonal adjustment
7. Transformation
8. Publication lag
9. Revision behavior
10. Licensing / redistribution constraints
```

## Recommended hierarchy

Where practical:

```text
National statistical agency / central bank
→ IMF / BIS / World Bank
→ FRED-hosted official series
→ other licensed providers
```

Do not assume the first similarly named series is interchangeable with the desired concept.

## Suggested registry expansion

Create a separate production mapping file such as:

```yaml
mappings:
  - country: USA
    indicator: inflation
    provider: FRED
    series_id: VERIFIED_ID
    source_unit: index
    transform: yoy_pct
    frequency: monthly
```

The actual IDs should be entered only after review.

## Update strategy

Macro data is best described as **latest available**, not universally real-time.

A Netlify Scheduled Function dispatches a Background Function that:

```text
check providers
→ detect new / revised observations
→ validate
→ insert a new immutable vintage only when a value changed
→ record validation and provider lineage
→ refresh coverage metadata
```

Polling every few hours is enough for a portfolio deployment. A mature system can become release-calendar aware.
