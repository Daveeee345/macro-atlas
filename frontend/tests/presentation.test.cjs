const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
// Compile the pure presentation module in memory; no browser or extra test framework.
const Module = require("node:module");
const file = path.resolve(__dirname, "../lib/universe.ts");
const mod = new Module(file, module);
mod._compile(
  ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  file,
);
const { inUniverse, layerValue, layerColor, formatMetric } = mod.exports;
const catalog = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../backend/data/country_catalog.json"),
    "utf8",
  ),
);
const empty = {
  ...catalog.find((c) => c.code === "NPL"),
  coverage_score: 0,
  available_indicator_count: 0,
  required_indicator_count: 8,
  available_indicators: [],
  metrics: { gdp_growth: { value: null, percentile: null } },
  regime: "UNCLASSIFIED",
};

test("no observations do not produce zero metrics or a regime color", () => {
  assert.equal(layerValue(empty, "gdp_growth"), "Not available");
  assert.equal(layerValue(empty, "state"), "Not classified");
  assert.equal(layerColor(empty, "gdp_growth"), "#eef1f3");
  assert.equal(formatMetric(null), "Not available");
});
test("observed zero remains visible and distinct from missing", () => {
  const c = {
    ...empty,
    available_indicators: ["gdp_growth"],
    metrics: { gdp_growth: { value: 0 } },
  };
  assert.equal(layerValue(c, "gdp_growth"), "0.0%");
  assert.notEqual(layerColor(c, "gdp_growth"), layerColor(empty, "gdp_growth"));
});
test("coverage and custom filters do not turn metadata into observations", () => {
  assert.equal(layerValue(empty, "coverage"), "0% coverage");
  assert.equal(inUniverse(empty, "custom", ["NPL"]), true);
  assert.equal(inUniverse(empty, "core"), false);
  assert.equal(inUniverse(empty, "asia"), true);
  assert.equal(inUniverse(empty, "g7"), false);
  const usa = catalog.find((c) => c.code === "USA");
  assert.equal(
    inUniverse(
      { ...usa, region: "North America", geographic_region: "Americas" },
      "americas",
    ),
    true,
  );
  assert.equal(inUniverse(usa, "g7"), true);
  assert.equal(catalog.filter((c) => inUniverse(c, "core")).length, 8);
});
test("all Natural Earth shapes have catalog metadata and valid paths", async () => {
  const { feature } = await import("topojson-client");
  const { geoPath, geoNaturalEarth1 } = await import("d3-geo");
  const topology = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../public/maps/countries-110m.json"),
      "utf8",
    ),
  );
  const features = feature(topology, topology.objects.countries).features;
  const aliases = { "N. Cyprus": "Northern Cyprus" };
  const missing = [];
  for (const f of features) {
    const c =
      catalog.find(
        (c) => f.id != null && c.numeric_code === String(f.id).padStart(3, "0"),
      ) ||
      catalog.find(
        (c) => c.name === (aliases[f.properties.name] || f.properties.name),
      );
    if (!c) missing.push(f.properties.name);
    const d = geoPath(geoNaturalEarth1())(f);
    assert.ok(d && !d.includes("NaN"));
  }
  assert.deepEqual(missing, []);
  assert.ok(features.length > 170);
});
