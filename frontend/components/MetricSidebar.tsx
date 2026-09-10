"use client";
import { tierName } from "@/lib/universe";
import type { CountrySnapshot } from "@/lib/types";

import Sparkline from "./Sparkline";
import { ChevronRight, InfoIcon } from "./Icons";

const metricOrder = [
  ["gdp_growth", "Real GDP Growth", "% YoY"],
  ["inflation", "Inflation (CPI)", "% YoY"],
  ["policy_rate", "Policy Rate", "%"],
  ["real_policy_rate", "Real Policy Rate", "% (ex. CPI)"],
  ["current_account", "Current Account", "% of GDP"],
  ["gov_10y", "10Y Government Yield", "%"],
] as const;

function formatValue(v: number | null, unit: string) {
  if (v === null || v === undefined) return "—";
  if (unit.includes("%")) return `${v.toFixed(1)}%`;
  return v.toFixed(2);
}

export default function MetricSidebar({
  country,
  countries,
  onSelectCountry,
  onLineage,
}: {
  country: CountrySnapshot | null;
  countries: CountrySnapshot[];
  onSelectCountry: (code: string) => void;
  onLineage: (indicator: string) => void;
}) {
  return (
    <aside className="left-sidebar">
      <div className="sidebar-header">
        <strong>ECONOMY MONITOR</strong>
        <span>01 / OVERVIEW</span>
      </div>
      <div className="country-select">
        <span className="country-code-mark">
          {country?.iso2 || country?.code || "—"}
        </span>
        <div>
          <strong>{country?.name || "Loading…"}</strong>
          <span>{country?.code || "—"}</span>
        </div>
        <ChevronRight />
        <select
          aria-label="Select economy"
          value={country?.code || ""}
          onChange={(e) => onSelectCountry(e.target.value)}
        >
          {!country && <option value="">Loading…</option>}
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {country && (
        <div className="country-metadata">
          <span>
            Tier {country.tier} · {tierName(country.tier)}
          </span>
          <span>{country.coverage_score}% data coverage</span>
          <div className="coverage-track">
            <i style={{ width: `${country.coverage_score}%` }} />
          </div>
        </div>
      )}
      <div className="sidebar-section-label">
        <span>KEY MACRO INDICATORS</span>
        <span>Δ prior period</span>
      </div>
      <div className="metric-list">
        {metricOrder.map(([id, label, unit]) => {
          const m = country?.metrics?.[id];
          const delta = m?.delta;
          return (
            <div
              className="metric-row"
              key={`${country?.code}-${m?.period}-${id}`}
            >
              <button
                disabled={m?.value == null || id === "real_policy_rate"}
                className="lineage-trigger"
                onClick={() => onLineage(id)}
                aria-label={`Open lineage for ${label}`}
              >
                <InfoIcon size={12} />
              </button>
              <div className="metric-top">
                <div>
                  <strong>{label}</strong>
                  <span>{unit}</span>
                </div>
                <div className="metric-number">
                  <strong>{formatValue(m?.value ?? null, unit)}</strong>
                  <span
                    className={
                      delta == null
                        ? "flat"
                        : delta > 0
                          ? "up"
                          : delta < 0
                            ? "down"
                            : "flat"
                    }
                  >
                    {delta == null
                      ? "No prior observation"
                      : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}pp`}
                  </span>
                </div>
              </div>
              <div className="metric-bottom">
                <div className="spark-wrap">
                  {m?.value == null ? (
                    <span className="missing-observation">
                      No observation available
                    </span>
                  ) : (
                    <Sparkline history={m.history} />
                  )}
                  <div className="spark-years">
                    <span>{m?.history[0]?.period || "—"}</span>
                    <span>{m?.history.at(-1)?.period || "—"}</span>
                  </div>
                </div>
                <div className="metric-percentile">
                  <strong>
                    {m?.percentile == null ? "—" : Math.round(m.percentile)}
                    <small> / 100</small>
                  </strong>
                  <span>History percentile</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
