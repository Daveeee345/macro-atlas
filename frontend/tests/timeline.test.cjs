const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const Module = require("node:module");

const file = path.resolve(__dirname, "../lib/timeline.ts");
const mod = new Module(file, module);
mod._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { periodsForRange, nextPlaybackPeriod } = mod.exports;

const periods = Array.from({ length: 48 }, (_, index) => `${2014 + Math.floor(index / 4)}-Q${(index % 4) + 1}`);

test("timeline ranges represent 1Y, 5Y, 10Y and MAX in quarters", () => {
  assert.equal(periodsForRange(periods, 4).length, 4);
  assert.equal(periodsForRange(periods, 20).length, 20);
  assert.equal(periodsForRange(periods, 40).length, 40);
  assert.equal(periodsForRange(periods, 0).length, 48);
});

test("timeline playback advances exactly one canonical quarter and stops at latest", () => {
  assert.equal(nextPlaybackPeriod(periods, periods[10]), periods[11]);
  assert.equal(nextPlaybackPeriod(periods, periods.at(-1)), null);
  assert.equal(nextPlaybackPeriod(periods, null), periods[0]);
});
