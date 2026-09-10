"use client";
import type { CountrySnapshot } from "@/lib/types";
import Sparkline from "./Sparkline";
import DataCoveragePanel from "./DataCoveragePanel";
import { tierName, formatMetric } from "@/lib/universe";
const dims = [
  ["Growth", "gdp_growth"],
  ["Inflation", "inflation"],
  ["Policy", "policy_rate"],
  ["Real rates", "real_policy_rate"],
  ["External", "current_account"],
  ["Credit", "credit_growth"],
] as const;
export default function CountryDeepDive({
  country,
}: {
  country: CountrySnapshot | null;
}) {
  if (!country)
    return (
      <section className="central-view loading-panel">Loading country…</section>
    );
  const cx = 170,
    cy = 160,
    R = 108;
  const pts = dims.map(([, id], i) => {
    const percentile = country.metrics[id]?.percentile;
    if (percentile == null) return null;
    const a = -Math.PI / 2 + (i / dims.length) * Math.PI * 2;
    return [
      cx + (Math.cos(a) * R * percentile) / 100,
      cy + (Math.sin(a) * R * percentile) / 100,
    ];
  });
  return (
    <section className="central-view country-deep">
      <div className="view-head">
        <div>
          <span className="eyebrow">
            {country.code} / TIER {country.tier} · {tierName(country.tier)}
          </span>
          <h1>{country.name}</h1>
        </div>
        <span className="view-badge">
          {country.latest_period || "NO OBSERVATIONS"}
        </span>
      </div>
      <DataCoveragePanel country={country} compact />
      <div className="country-hero">
        <div className="fingerprint">
          <div className="section-label">
            MACRO FINGERPRINT / HISTORICAL PERCENTILES
          </div>
          <svg
            viewBox="0 0 340 320"
            aria-label="Macro fingerprint with missing dimensions omitted"
          >
            {[0.25, 0.5, 0.75, 1].map((r) => (
              <circle
                key={r}
                cx={cx}
                cy={cy}
                r={R * r}
                className="radar-ring"
              />
            ))}
            {dims.map(([label], i) => {
              const a = -Math.PI / 2 + (i / dims.length) * Math.PI * 2;
              return (
                <g key={label}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={cx + Math.cos(a) * R}
                    y2={cy + Math.sin(a) * R}
                    className="radar-axis"
                  />
                  <text
                    x={cx + Math.cos(a) * (R + 22)}
                    y={cy + Math.sin(a) * (R + 22)}
                    textAnchor="middle"
                    className="radar-label"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            {pts.every((p) => p !== null) && (
              <polygon
                points={pts.map((p) => p!.join(",")).join(" ")}
                className="radar-shape"
              />
            )}
            {pts.map(
              (p, i) =>
                p && (
                  <circle
                    key={i}
                    cx={p[0]}
                    cy={p[1]}
                    r="3"
                    className="radar-dot"
                  />
                ),
            )}
            <text x={cx} y={cy} textAnchor="middle" className="radar-center">
              {country.code}
            </text>
          </svg>
          {pts.some((p) => !p) && (
            <p className="fingerprint-note">
              Incomplete fingerprint · missing dimensions are omitted.
            </p>
          )}
        </div>
        <div className="current-state">
          <div className="section-label">CURRENT HISTORICAL POSITION</div>
          {dims.map(([label, id]) => {
            const p = country.metrics[id]?.percentile;
            return (
              <div className="state-row" key={id}>
                <span>{label}</span>
                <div className="state-line">
                  {p != null && (
                    <>
                      <i style={{ left: `${p}%` }} />
                      <span style={{ width: `${p}%` }} />
                    </>
                  )}
                </div>
                <strong>{p == null ? "N/A" : Math.round(p)}</strong>
              </div>
            );
          })}
          <p className="fingerprint-note">
            0–100 percentile within each economy’s available history. Missing
            data is never positioned at zero.
          </p>
        </div>
      </div>
      <div className="deep-charts">
        {dims.map(([label, id]) => (
          <div className="deep-chart" key={id}>
            <div>
              <span>{label.toUpperCase()}</span>
              <b>{formatMetric(country.metrics[id]?.value)}</b>
            </div>
            <Sparkline
              history={country.metrics[id]?.history || []}
              width={260}
              height={62}
            />
            <footer>
              <span>
                {country.metrics[id]?.history[0]?.period || "No history"}
              </span>
              <span>{country.metrics[id]?.period || "—"}</span>
            </footer>
          </div>
        ))}
      </div>
    </section>
  );
}
