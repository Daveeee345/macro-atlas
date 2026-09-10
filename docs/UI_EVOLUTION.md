# Global universe and interactive Atlas

## Implementation

- An additive SQLite `country_catalog` stores geographic/tier metadata separately
  from the existing analytical countries and observation/vintage tables.
- The catalog has 253 entries: eight core, 42 extended and 203 global entries.
  These include territories, disputed geographic units and the Euro Area aggregate;
  this is not a sovereign-country count. Metadata provenance and license are in
  `backend/data/COUNTRY_CATALOG.md`.
- No macro observations were added or generated. At implementation time only the
  existing eight synthetic demo economies have analytical coverage.
- Eight required indicators define coverage: seven observed series plus the
  derived real policy rate. Coverage is valid, non-null availability divided by
  eight, not an economic score. Zero remains a valid observation. Real-rate
  coverage requires both valid inputs. Historical requests use existing
  latest-at-or-before-period semantics; coverage does not certify freshness.
- `/api/countries` retains its analytical-country default. `/api/universe`,
  `/api/coverage`, and optional `universe`, `tier`, `region`, `coverage_min` and
  `period` query filters expose the extended model. Individual country endpoints
  return explicit empty snapshots for uncovered catalog entries.

## Map and interactions

`WorldAtlasView` memoizes the local Natural Earth 110m country paths with
`d3-geo` / `topojson-client`. Every one of the map's 177 shapes resolves to catalog
metadata by numeric identifier or an explicit geographic-name alias. Core
coordinates retain the existing API's geographic anchors. Euro Area remains an
aggregate marker; its values are not assigned to individual member countries.

D3 zoom owns a single SVG group transform, with a 1–5× scale limit and bounded
panning. React is updated at gesture completion rather than on every animation
frame. Country selection focuses the geography in 650 ms; Escape and reset return
to the whole-world view. Shape hover and keyboard focus show tier, coverage and
selected-layer information. Geography stays visible outside the selected universe.

Layers: macro state, growth, inflation, policy, real rates, external balance and
coverage. Filters: all, core, G20 national members, G7, ASEAN, regions and a custom
selection. Group membership is current catalog metadata, not historical membership;
G20 excludes the unavailable EU/AU aggregate entities rather than substituting Euro
Area for the EU. Developed/emerging classifications are not inferred.

Only covered economies receive analytical nodes. Label density increases with
zoom, using collision checks and selected/hovered priority. Rings encode coverage,
colors encode the selected layer, and tier controls analytical emphasis.

Comparison links connect up to four covered peers, prioritizing the available
USA/China/Japan/India core series. Two links animate a subtle 9-second dash flow.
Links never imply exposure, causality or shock transmission. The selected node has
one 4-second breathing outline and a one-shot state-refresh ripple.

## Analytical surfaces

- Sidebar: tier/coverage header, missing-data states, small sparklines and
  historical percentiles; observed-series lineage remains available.
- Inspector: working Snapshot, Regime, Compare and Data tabs; shared percentage
  scale for the indicator chart; recent changes and coverage inventory.
- Time Machine: quarterly keyboard-accessible slider, playback, 1Y/5Y/10Y/MAX
  windows, latest versus historical labeling. Playback waits for the data request.
  Old observations retain their original map timestamp while new data loads.
- Regimes: D3 interpolation of marker/label coordinates and a short selected-country
  trail. Policy: filtered real-rate positions and ranking. Compare: two functional
  country selectors, transitioning percentile positions and explicit N/A spreads.
- Deep dive: tier/coverage metadata; missing radar dimensions are omitted, never
  plotted at zero. Data: actual global coverage totals, status distribution and
  CSV export of available observed-series rows.

`prefers-reduced-motion` disables breathing, flowing dashes, ripples and CSS
transitions. D3 focus/zoom/marker transitions use zero duration. All map functions
remain available through keyboard-accessible selectors, country buttons and zoom
controls; shape tooltips also respond to focus.

## Performance and dependencies

Added `d3-selection`, `d3-zoom`, `d3-transition` and their TypeScript definitions.
Existing `d3-geo` and `topojson-client` are retained. No overlapping animation
framework was added. FastAPI uses built-in GZip middleware for the universe response.
The frontend projects Regime/Policy presentation rows from backend-computed snapshot
fields, eliminating duplicate analytics requests during playback.

## Verification commands

```sh
cd backend
python3 -m pytest -q
cd ../frontend
npm run test:unit
npm run typecheck
npm run build
```

Backend regression tests cover backward compatibility, dynamic coverage, valid
zeros, invalid inputs, historical availability, null comparisons, filter semantics,
summary counts, and idempotent metadata initialization. Frontend tests cover
missing-value encodings, filters and complete map-shape/catalog matching.

## Limits

The 110m base map omits polygons for some microstates and small territories. All
catalog entries remain accessible through country selection/search. Tier 2/3
metrics stay unavailable until verified observations are ingested. Coverage counts
existing demo observations but does not turn them into official data. This change
does not change the engine's existing vintage/history alignment or its 40-observation
chart-history window. Custom universes are session-local. Full cross-browser,
OS-level reduced-motion and large production-universe load testing remain separate
validation work; no frame-rate or latency guarantee is claimed.

## Changed files

Backend:
- `app/storage/repository.py`, `app/service.py`, `app/api/routes.py`, `app/main.py`
- New `app/coverage.py`, `data/country_catalog.json`, `data/COUNTRY_CATALOG.md`,
  `data/COUNTRY_CATALOG_LICENSE.txt`, `tests/test_universe.py`

Frontend:
- `components/WorldAtlasView.tsx`, `MacroApp.tsx`, `MetricSidebar.tsx`,
  `RightInspector.tsx`, `Timeline.tsx`, `TopNav.tsx`, `BottomBar.tsx`
- `components/RegimeView.tsx`, `PolicyView.tsx`, `CompareView.tsx`,
  `CountryDeepDive.tsx`, `DataView.tsx`, `PercentileRing.tsx`
- New `components/UniverseSelector.tsx`, `DataCoveragePanel.tsx`,
  `RegimePointMark.tsx`, `lib/universe.ts`, `app/evolution.css`,
  `tests/presentation.test.cjs`
- `lib/api.ts`, `lib/types.ts`, `app/layout.tsx`, `package.json`,
  `package-lock.json`, `public/maps/README.md`

Documentation: root `README.md` and this implementation note.

## Browser checks performed

At the standard desktop viewport: world geometry, core and uncovered selection,
focus transforms, bounded zoom buttons, wheel zoom, drag pan, keyboard-focus
tooltip, layer switching, animated link styles, historical playback, coverage
inventory, ASEAN/custom filters, switching both comparison countries, N/A
comparisons, historical regime coordinates/trail, Policy filtering, global Data
counts, and an uncovered deep dive with no radar polygon or data points.

At 390 × 844: Atlas composition and zero horizontal document overflow were checked;
the temporary viewport override was reset afterward. Browser console checks showed
no warnings/errors during these checks. CSV download was verified from the saved
file because the browser did not emit its expected download event; the register
subsequently gained the existing credit-growth series as well.
