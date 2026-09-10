"use client";
import UniverseSelector from "./UniverseSelector";
import type { Universe } from "@/lib/universe";
import type { PolicyPoint } from "@/lib/types";

export default function PolicyView({
  points,
  selected,
  onSelect,
  universe,
  onUniverse,
}: {
  universe: Universe;
  onUniverse: (u: Universe) => void;
  points: PolicyPoint[];
  selected: string;
  onSelect: (code: string) => void;
}) {
  const ranked = points.slice().sort((a, b) => b.real_rate - a.real_rate);
  const min = Math.floor(Math.min(0, ...ranked.map((p) => p.real_rate))) - 1;
  const max = Math.ceil(Math.max(0, ...ranked.map((p) => p.real_rate))) + 1;
  const position = (value: number) => ((value - min) / (max - min)) * 100;
  return (
    <section className="central-view policy-view">
      <div className="view-head">
        <div>
          <span className="eyebrow">MONETARY CONDITIONS</span>
          <h1>Policy divergence</h1>
        </div>
        <UniverseSelector value={universe} onChange={onUniverse} />
      </div>
      <div className="rate-intro">
        <span>Ex-post real policy rate</span>
        <span>Lower real rate ← → Higher real rate</span>
      </div>
      {!ranked.length && (
        <p className="analytical-empty">
          No economies in this universe have comparable policy and inflation
          observations.
        </p>
      )}
      <div className="rate-plot">
        <div className="rate-axis">
          <span>{min}%</span>
          <span>{max}%</span>
        </div>
        {ranked.map((p, i) => (
          <button
            key={p.code}
            className={`rate-row ${selected === p.code ? "selected" : ""}`}
            onClick={() => onSelect(p.code)}
            aria-pressed={selected === p.code}
          >
            <span className="rate-country">
              <small>{String(i + 1).padStart(2, "0")}</small>
              <strong>{p.code}</strong>
              <span>{p.name}</span>
            </span>
            <span className="rate-track">
              <i className="rate-zero" style={{ left: `${position(0)}%` }} />
              <i
                className="rate-connector"
                style={{
                  left: `${Math.min(position(0), position(p.real_rate))}%`,
                  width: `${Math.abs(position(0) - position(p.real_rate))}%`,
                }}
              />
              <i
                className="rate-dot"
                style={{ left: `${position(p.real_rate)}%` }}
              />
            </span>
            <b>
              {p.real_rate >= 0 ? "+" : ""}
              {p.real_rate.toFixed(2)}%
            </b>
          </button>
        ))}
      </div>
      <div className="policy-table-head">
        <span>COUNTRY</span>
        <span>POLICY</span>
        <span>INFLATION</span>
        <span>REAL RATE</span>
        <span>HIST. %ILE</span>
      </div>
      <div className="policy-table">
        {ranked.map((p) => (
          <button
            key={p.code}
            className={selected === p.code ? "selected" : ""}
            onClick={() => onSelect(p.code)}
          >
            <span>
              <b>{p.code}</b> {p.name}
            </span>
            <span>{p.policy_rate.toFixed(2)}%</span>
            <span>{p.inflation.toFixed(2)}%</span>
            <span>{p.real_rate.toFixed(2)}%</span>
            <span>
              {p.real_rate_percentile == null
                ? "N/A"
                : `${Math.round(p.real_rate_percentile)} / 100`}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
