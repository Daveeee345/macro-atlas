# World base map

`countries-110m.json` is the world-atlas 2 country topology, downloaded from
https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json.

Source: https://github.com/topojson/world-atlas (ISC); geographic data from
Natural Earth, public domain: https://www.naturalearthdata.com/about/terms-of-use/.

Rendered locally with D3's Natural Earth 1 projection and topojson-client.
Coordinates for observed economies come from the existing API. All supplied shapes, including Antarctica, are rendered. The EUR marker represents
an aggregate; individual country shapes retain their own data availability.
Small territories omitted by the 110m topology remain accessible via the catalog.
Network arcs connect peers and imply neither exposure nor causality.
