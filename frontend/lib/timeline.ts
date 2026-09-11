export function periodsForRange(periods: string[], quarters: number): string[] {
  return quarters > 0 ? periods.slice(-quarters) : periods;
}

export function nextPlaybackPeriod(periods: string[], selected: string | null): string | null {
  if (!periods.length) return null;
  const index = periods.indexOf(selected || "");
  if (index >= periods.length - 1) return null;
  return periods[Math.max(0, index + 1)];
}
