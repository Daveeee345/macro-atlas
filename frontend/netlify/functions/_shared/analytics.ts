const REQUIRED_INDICATORS = [
  "gdp_growth",
  "inflation",
  "policy_rate",
  "real_policy_rate",
  "gov_10y",
  "current_account",
  "debt_gdp",
  "credit_growth",
] as const;

export { REQUIRED_INDICATORS };

export function clean(values: Array<number | null | undefined>): number[] {
  return values.filter((value): value is number => value != null && Number.isFinite(value));
}

export function percentileRank(history: Array<number | null>, current: number | null): number | null {
  if (current == null) return null;
  const values = clean(history);
  if (!values.length) return null;
  const less = values.filter((value) => value < current).length;
  const equal = values.filter((value) => value === current).length;
  return round((less + 0.5 * equal) / values.length * 100, 1);
}

export function realPolicyRate(policy: number | null, inflation: number | null): number | null {
  return policy == null || inflation == null ? null : round(policy - inflation, 2);
}

export function difference(left: number | null, right: number | null): number | null {
  return left == null || right == null ? null : round(left - right, 2);
}

export function regime(growth: number | null, inflation: number | null): string {
  if (growth == null || inflation == null) return "UNCLASSIFIED";
  if (growth >= 50 && inflation >= 50) return "OVERHEATING";
  if (growth >= 50) return "EXPANSION";
  if (inflation >= 50) return "STAGFLATION";
  return "SLOWDOWN";
}

export function rangeStats(values: Array<number | null>) {
  const valid = clean(values).sort((a, b) => a - b);
  if (!valid.length) return { min: null, median: null, max: null };
  const middle = Math.floor(valid.length / 2);
  const median = valid.length % 2 ? valid[middle] : (valid[middle - 1] + valid[middle]) / 2;
  return { min: round(valid[0], 2), median: round(median, 2), max: round(valid.at(-1)!, 2) };
}

export function coverage(metrics: Record<string, any>) {
  const available = REQUIRED_INDICATORS.filter((id) => {
    const metric = metrics[id] || {};
    const valid = id === "real_policy_rate"
      ? ["policy_rate", "inflation"].every((input) => metrics[input]?.validation_status === "VALID")
      : metric.validation_status === "VALID";
    return metric.value != null && Number.isFinite(metric.value) && valid;
  });
  const score = round(available.length / REQUIRED_INDICATORS.length * 100, 1);
  const status = score >= 90 ? "FULL" : score >= 70 ? "GOOD" : score >= 50 ? "PARTIAL" : score > 0 ? "LIMITED" : "UNAVAILABLE";
  return {
    coverage_score: score,
    available_indicator_count: available.length,
    required_indicator_count: REQUIRED_INDICATORS.length,
    data_status: status,
    available_indicators: available,
    unavailable_indicators: REQUIRED_INDICATORS.filter((id) => !available.includes(id)),
    coverage_method: "Valid, non-null latest available observations at or before the requested period; includes derived real rate. Availability, not freshness or economic strength.",
  };
}

export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
