import type { CountrySnapshot } from "./types";
export const universes = [
  "all",
  "core",
  "g20",
  "g7",
  "asean",
  "asia",
  "europe",
  "americas",
  "africa",
  "oceania",
  "custom",
] as const;
export type Universe = (typeof universes)[number];
export function inUniverse(
  c: CountrySnapshot,
  universe: Universe,
  custom: string[] = [],
) {
  if (universe === "all") return true;
  if (universe === "core") return c.is_core;
  if (universe === "custom") return custom.includes(c.code);
  if (["g7", "g20", "asean"].includes(universe))
    return c.groups.includes(universe.toUpperCase());
  return (c.geographic_region || c.region).toLowerCase() === universe;
}
export const indicatorLabels: Record<string, string> = {
  gdp_growth: "GDP growth",
  inflation: "Inflation",
  policy_rate: "Policy rate",
  real_policy_rate: "Real rate",
  gov_10y: "10Y government yield",
  current_account: "Current account",
  debt_gdp: "Debt / GDP",
  credit_growth: "Credit growth",
};
export type Layer =
  | "state"
  | "gdp_growth"
  | "inflation"
  | "policy_rate"
  | "real_policy_rate"
  | "current_account"
  | "coverage";
export const layers: { id: Layer; label: string }[] = [
  { id: "state", label: "Macro state" },
  { id: "gdp_growth", label: "Growth" },
  { id: "inflation", label: "Inflation" },
  { id: "policy_rate", label: "Policy" },
  { id: "real_policy_rate", label: "Real rates" },
  { id: "current_account", label: "External" },
  { id: "coverage", label: "Coverage" },
];
export const tierName = (tier: number) =>
  tier === 1 ? "Core" : tier === 2 ? "Extended" : "Global";
export const formatMetric = (n: number | null | undefined) =>
  n == null
    ? "Not available"
    : `${Object.is(Number(n.toFixed(1)), -0) ? "0.0" : n.toFixed(1)}%`;
const regimes: Record<string, string> = {
  EXPANSION: "#438773",
  OVERHEATING: "#b77564",
  STAGFLATION: "#ad945e",
  SLOWDOWN: "#8594a5",
  UNCLASSIFIED: "#e9edf0",
};
export function layerValue(c: CountrySnapshot, layer: Layer) {
  if (layer === "coverage") return `${c.coverage_score}% coverage`;
  if (layer === "state")
    return c.regime === "UNCLASSIFIED"
      ? "Not classified"
      : c.regime.toLowerCase();
  return c.available_indicators.includes(layer)
    ? formatMetric(c.metrics[layer]?.value)
    : "Not available";
}
export function layerColor(c: CountrySnapshot, layer: Layer) {
  if (layer === "coverage")
    return c.coverage_score >= 90
      ? "#497ca5"
      : c.coverage_score >= 70
        ? "#7199b7"
        : c.coverage_score >= 50
          ? "#a0bbcf"
          : c.coverage_score > 0
            ? "#d0dce6"
            : "#eef1f3";
  if (layer === "state") return regimes[c.regime] || regimes.UNCLASSIFIED;
  const m = c.metrics[layer];
  if (!m || m.value == null || !c.available_indicators.includes(layer))
    return "#eef1f3";
  const n = m.value;
  if (layer === "gdp_growth")
    return n >= 5
      ? "#438773"
      : n >= 2
        ? "#567fac"
        : n >= 0
          ? "#9aa8b4"
          : "#b77564";
  if (layer === "real_policy_rate" || layer === "current_account")
    return n >= 2
      ? "#456f99"
      : n >= 0
        ? "#8ca7bf"
        : n >= -2
          ? "#b9ac92"
          : "#b77564";
  return n >= 6
    ? "#b77564"
    : n >= 3
      ? "#b49b6b"
      : n >= 0
        ? "#7496b3"
        : "#b2c3d2";
}
export function legend(layer: Layer): [string, string][] {
  if (layer === "coverage")
    return [
      ["#497ca5", "90–100 Full"],
      ["#7199b7", "70–89 Good"],
      ["#a0bbcf", "50–69 Partial"],
      ["#d0dce6", "1–49 Limited"],
      ["#eef1f3", "0 No analytics"],
    ];
  if (layer === "state")
    return Object.entries(regimes).map(([label, color]) => [
      color,
      label.toLowerCase(),
    ]);
  if (layer === "gdp_growth")
    return [
      ["#438773", "≥5%"],
      ["#567fac", "2–5%"],
      ["#9aa8b4", "0–2%"],
      ["#b77564", "<0%"],
      ["#eef1f3", "N/A"],
    ];
  if (layer === "real_policy_rate" || layer === "current_account")
    return [
      ["#456f99", "≥2%"],
      ["#8ca7bf", "0–2%"],
      ["#b9ac92", "−2–0%"],
      ["#b77564", "<−2%"],
      ["#eef1f3", "N/A"],
    ];
  return [
    ["#b77564", "≥6%"],
    ["#b49b6b", "3–6%"],
    ["#7496b3", "0–3%"],
    ["#b2c3d2", "<0%"],
    ["#eef1f3", "N/A"],
  ];
}
