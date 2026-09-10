# Design System

Macro Atlas intentionally avoids generic SaaS dashboard aesthetics.

## Core visual language

- white / near-white background,
- institutional blue as the restrained accent,
- hairline dividers,
- compact labels,
- dense but ordered analytical content,
- near-zero decorative gradients,
- small corner radii,
- no glassmorphism,
- no giant KPI cards,
- numerical emphasis through monospace typography.

## Layout

```text
Top navigation
┌────────────┬────────────────────────────┬──────────────┐
│ Country /  │ Main analytical canvas     │ Contextual   │
│ metrics    │                            │ inspector    │
└────────────┴────────────────────────────┴──────────────┘
System status strip
Historical timeline
```

## Visual semantics

- node position must encode geography or analytical state,
- percentile rings encode historical position,
- regime colors encode the transparent rule-based classification,
- horizontal policy position encodes ex-post real policy rate,
- line charts are descriptive historical series,
- selection glow is UI focus only, not analytical strength.
