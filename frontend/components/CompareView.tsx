"use client";
import type { CompareResponse, CountrySnapshot } from "@/lib/types";
import { indicatorLabels } from "@/lib/universe";
export default function CompareView({
  data,
  countries,
  left,
  right,
  onLeft,
  onRight,
  busy,
}: {
  data: CompareResponse | null;
  countries: CountrySnapshot[];
  left: string;
  right: string;
  onLeft: (code: string) => void;
  onRight: (code: string) => void;
  busy: boolean;
}) {
  return (
    <section className="central-view compare-view">
      <div className="view-head">
        <div>
          <span className="eyebrow">CROSS-COUNTRY RESEARCH</span>
          <h1>Macro comparison</h1>
        </div>
        <div className="compare-selectors">
          <select
            aria-label="Compare country A"
            value={left}
            onChange={(e) => onLeft(e.target.value)}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <span>VS</span>
          <select
            aria-label="Compare country B"
            value={right}
            onChange={(e) => onRight(e.target.value)}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="compare-header">
        <span>INDICATOR</span>
        <span>{data?.left.code || left}</span>
        <span>HIST. POSITION</span>
        <span>{data?.right.code || right}</span>
        <span>HIST. POSITION</span>
        <span>DIFFERENCE</span>
      </div>
      {busy && (
        <p className="comparison-loading" role="status">
          Loading comparison observations; previous pair remains labeled below…
        </p>
      )}
      <div className={`compare-rows ${busy ? "pending" : ""}`} aria-busy={busy}>
        {data?.rows.map((row) => (
          <div className="compare-row" key={row.indicator}>
            <strong>{indicatorLabels[row.indicator]}</strong>
            <div className="compare-value">
              <b key={row.left.value} className="state-enter">
                {fmt(row.left.value)}
              </b>
              <small>{row.left.period || "No observation"}</small>
            </div>
            <Position value={row.left.percentile} />
            <div className="compare-value">
              <b key={row.right.value} className="state-enter">
                {fmt(row.right.value)}
              </b>
              <small>{row.right.period || "No observation"}</small>
            </div>
            <Position value={row.right.percentile} alt />
            <div className="spread-value">
              <b>
                {row.spread == null
                  ? "N/A"
                  : `${row.spread >= 0 ? "+" : ""}${row.spread.toFixed(2)}pp`}
              </b>
              <small>
                {row.spread == null
                  ? "Missing observation"
                  : row.spread === 0
                    ? "Equal values"
                    : row.spread > 0
                      ? `${data.left.code} higher`
                      : `${data.right.code} higher`}
              </small>
            </div>
          </div>
        ))}
      </div>
      <div className="compare-note">
        <strong>INTERPRETATION</strong>
        <span>
          Differences are arithmetic. Historical positions use each economy’s
          own observations. Missing values are not zero.
        </span>
      </div>
    </section>
  );
}
function Position({
  value,
  alt = false,
}: {
  value: number | null;
  alt?: boolean;
}) {
  return (
    <div
      className={`percentile-track ${alt ? "alt" : ""} ${value == null ? "is-missing" : ""}`}
    >
      {value != null && (
        <>
          <span style={{ width: `${value}%` }} />
          <i style={{ left: `${value}%` }} />
        </>
      )}
      <b>{value == null ? "N/A" : `${Math.round(value)} / 100`}</b>
    </div>
  );
}
function fmt(value: number | null) {
  return value == null ? "N/A" : `${value.toFixed(2)}%`;
}
