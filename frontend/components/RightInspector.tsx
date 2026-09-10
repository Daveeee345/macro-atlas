"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { CountrySnapshot, PolicyPoint } from "@/lib/types";
import DataCoveragePanel from "./DataCoveragePanel";
import { indicatorLabels, tierName } from "@/lib/universe";
const regimeText: Record<string, string> = {
  EXPANSION:
    "Growth is above its historical median; inflation is below its own median.",
  OVERHEATING: "Growth and inflation are both above their historical medians.",
  STAGFLATION:
    "Growth is below its historical median while inflation is above its own median.",
  SLOWDOWN: "Growth and inflation are both below their historical medians.",
  UNCLASSIFIED:
    "Available observations do not support a growth–inflation classification.",
};
export default function RightInspector({
  country,
  policy,
  coverageMode = false,
  period,
}: {
  country: CountrySnapshot | null;
  policy: PolicyPoint[];
  coverageMode?: boolean;
  period: string | null;
}) {
  const [tab, setTab] = useState("snapshot"),
    [windowSize, setWindowSize] = useState(40);
  useEffect(() => setTab(coverageMode ? "data" : "snapshot"), [coverageMode]);
  if (!country)
    return (
      <aside className="right-inspector loading-panel" role="status">
        Loading country context…
      </aside>
    );
  const m = country.metrics;
  const realRate = m.real_policy_rate?.value;
  const effective = tab;
  const peers = policy
    .filter((p) => p.code !== country.code)
    .sort((a, b) => b.real_rate - a.real_rate);
  const changes = Object.values(m)
    .filter((m) => m.delta != null && m.value != null)
    .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
    .slice(0, 3);
  const comparison = (
    <div className="policy-list">
      <div className="section-label">PEER POSITION · REAL RATE SPREAD</div>
      {realRate == null ? (
        <p className="inspector-empty">
          Real-rate comparison is unavailable for this economy.
        </p>
      ) : (
        peers.slice(0, 7).map((p, i) => (
          <div className="policy-item" key={p.code}>
            <span>{i + 1}</span>
            <strong>{p.code}</strong>
            <span>{p.name}</span>
            <b>
              {p.real_rate - realRate >= 0 ? "+" : ""}
              {(p.real_rate - realRate).toFixed(2)}pp
            </b>
          </div>
        ))
      )}
      <Link className="research-link" href="/compare">
        Open country comparison ↗
      </Link>
    </div>
  );
  const regimePanel = (
    <div className="regime-box">
      <div className="section-label">
        MACRO STATE / {period?.replace("-", " ") || "NO OBSERVATIONS"}
      </div>
      <div className={`regime-status ${country.regime.toLowerCase()}`}>
        <i />
        {country.regime === "UNCLASSIFIED" ? "NOT CLASSIFIED" : country.regime}
      </div>
      <p>{regimeText[country.regime]}</p>
    </div>
  );
  return (
    <aside className="right-inspector">
      <div className="inspector-title">
        <div>
          <strong>{country.name.toUpperCase()}</strong>
          <span>{country.code}</span>
        </div>
        <span>TIER {country.tier}</span>
      </div>
      <div
        className="inspector-tabs"
        role="tablist"
        aria-label="Country inspector"
      >
        {["snapshot", "regime", "compare", "data"].map((t) => (
          <button
            role="tab"
            aria-selected={effective === t}
            key={t}
            className={effective === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        className="inspector-body state-enter"
        key={`${country.code}-${period}-${effective}`}
      >
        {effective === "data" ? (
          <DataCoveragePanel country={country} />
        ) : (
          <>
            {effective === "snapshot" && (
              <>
                <p className="inspector-summary">
                  {country.available_indicator_count
                    ? `${country.name} · ${tierName(country.tier)} economy. ${country.available_indicator_count} of ${country.required_indicator_count} required indicators available.`
                    : "Geographic coverage is available. No valid macro observations are connected for this economy."}
                </p>
                {regimePanel}
                <div className="percentile-profile">
                  {[
                    "gdp_growth",
                    "inflation",
                    "real_policy_rate",
                    "current_account",
                  ].map((id) => (
                    <div key={id}>
                      <span>{indicatorLabels[id]}</span>
                      <div>
                        {m[id]?.percentile != null && (
                          <i style={{ left: `${m[id].percentile}%` }} />
                        )}
                      </div>
                      <b>
                        {m[id]?.percentile == null
                          ? "—"
                          : `${Math.round(m[id].percentile)}`}
                      </b>
                    </div>
                  ))}
                  <small>Within-economy historical percentiles / 100</small>
                </div>
                <div className="indicator-chart">
                  <div className="section-head">
                    <span>KEY INDICATORS · %</span>
                    <div>
                      {[
                        [20, "5Y"],
                        [40, "10Y"],
                        [Infinity, "All"],
                      ].map(([size, label]) => (
                        <button
                          key={label}
                          className={windowSize === size ? "active" : ""}
                          onClick={() => setWindowSize(Number(size))}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="line-blue" />
                      Growth
                    </span>
                    <span>
                      <i className="line-navy" />
                      Inflation
                    </span>
                    <span>
                      <i className="line-gray" />
                      Policy
                    </span>
                  </div>
                  <MultiLineChart country={country} windowSize={windowSize} />
                </div>
                <div className="recent-changes">
                  <div className="section-label">
                    RECENT OBSERVATION CHANGES
                  </div>
                  {changes.length ? (
                    changes.map((change) => (
                      <div key={change.id}>
                        <span>{indicatorLabels[change.id]}</span>
                        <b>
                          {change.delta! >= 0 ? "+" : ""}
                          {change.delta!.toFixed(2)}pp
                        </b>
                        <small>{change.period}</small>
                      </div>
                    ))
                  ) : (
                    <p>No comparable prior observations.</p>
                  )}
                </div>
                <DataCoveragePanel country={country} compact />
              </>
            )}
            {effective === "regime" && (
              <>
                {regimePanel}
                <p className="inspector-summary">
                  Median thresholds classify each economy using its own history.
                  A regime is descriptive; it is not a forecast or a
                  cross-country risk score.
                </p>
                <div className="regime-details">
                  {["gdp_growth", "inflation"].map((id) => (
                    <div key={id}>
                      <span>{indicatorLabels[id]} percentile</span>
                      <strong>{m[id]?.percentile ?? "—"}</strong>
                    </div>
                  ))}
                </div>
                <Link className="research-link" href="/regimes">
                  Open global regime plane ↗
                </Link>
              </>
            )}
            {effective === "compare" && comparison}
          </>
        )}
      </div>
    </aside>
  );
}

function MultiLineChart({
  country,
  windowSize,
}: {
  country: CountrySnapshot;
  windowSize: number;
}) {
  const ids = ["gdp_growth", "inflation", "policy_rate"];
  const series = ids.map((id) =>
    (country.metrics[id]?.history || []).slice(-windowSize),
  );
  const vals = series.flat().map((p) => p.value);
  if (!vals.length)
    return <p className="chart-empty">No observations available.</p>;
  const min = Math.floor(Math.min(...vals)),
    max = Math.ceil(Math.max(...vals));
  const range = max - min || 1;
  const dates = Array.from(new Set(series.flat().map((p) => p.period))).sort();
  const classes = ["blue", "navy", "gray"];
  return (
    <>
      <svg
        className="multi-chart"
        viewBox="0 0 300 138"
        role="img"
        aria-label="GDP growth, inflation and policy rate on a shared percentage scale"
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="28"
              x2="295"
              y1={12 + i * 34}
              y2={12 + i * 34}
              className="chart-grid"
            />
            <text x="0" y={15 + i * 34} className="chart-tick">
              {(max - (i * range) / 3).toFixed(0)}%
            </text>
          </g>
        ))}
        {series.map((hist, k) => (
          <polyline
            key={ids[k]}
            points={hist
              .map(
                (d) =>
                  `${28 + (dates.indexOf(d.period) / Math.max(1, dates.length - 1)) * 267},${114 - ((d.value - min) / range) * 102}`,
              )
              .join(" ")}
            className={`chart-line ${classes[k]}`}
          />
        ))}
        <text x="28" y="135" className="chart-tick">
          {dates[0]}
        </text>
        <text x="295" y="135" textAnchor="end" className="chart-tick">
          {dates.at(-1)}
        </text>
      </svg>
    </>
  );
}
