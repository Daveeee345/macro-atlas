# Methodology

## Objective

Macro Atlas is a **descriptive macro intelligence system**. Its purpose is to standardize observed macro series and make current states comparable to each economy's own history.

It is not designed to estimate causal effects or forecast macroeconomic outcomes.

## Historical percentile

For an indicator with historical values `x_1 ... x_n` and current value `x_t`, the V1 engine uses an inclusive percentile rank:

```text
rank = (count(values < current) + 0.5 × count(values = current)) / n × 100
```

Interpretation:

- `50` ≈ historical median position,
- high percentile = historically high level for that specific indicator,
- low percentile = historically low level.

A percentile is **not a risk score** and is not inherently good or bad.

## Real policy rate

V1 uses an ex-post descriptive approximation:

```text
Real Policy Rate = Nominal Policy Rate − Headline CPI YoY Inflation
```

This is intentionally labeled as an ex-post real policy measure. It is not the same as an ex-ante real rate based on inflation expectations.

## Country divergence

```text
Divergence = Indicator(A) − Indicator(B)
```

The value is an arithmetic spread only. It does not imply convergence, causality or expected market performance.

## Regime classification

V1 classifies the joint historical state of growth and inflation using within-country percentiles:

| Growth | Inflation | Label |
|---|---|---|
| ≥ 50 | < 50 | Expansion |
| ≥ 50 | ≥ 50 | Overheating |
| < 50 | ≥ 50 | Stagflation |
| < 50 | < 50 | Slowdown |

This is an **internal visualization taxonomy**, not a claim that these four labels are the unique or canonical macroeconomic regime definitions.

## Frequency handling

Production data should remain at source-native frequency. Do not convert quarterly GDP into fake daily observations. The UI should expose observation periods and source freshness.

## Revisions and vintages

Production storage should retain revisions rather than silently overwriting historical observations. For providers that support vintages, store:

```text
observation period
vintage / release date
value
retrieval timestamp
```

## AI policy

If a future narrative assistant is added, it may summarize validated structured facts, but it must not invent numerical values or override deterministic calculations.
