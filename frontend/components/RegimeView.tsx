"use client";
import { useEffect, useRef, useState } from "react";
import RegimePointMark from "./RegimePointMark";
import UniverseSelector from "./UniverseSelector";
import type { Universe } from "@/lib/universe";
import type { RegimePoint } from "@/lib/types";

export default function RegimeView({
  points,
  selected,
  onSelect,
  period,
  universe,
  onUniverse,
}: {
  period: string | null;
  universe: Universe;
  onUniverse: (u: Universe) => void;
  points: RegimePoint[];
  selected: string;
  onSelect: (code: string) => void;
}) {
  const [trail, setTrail] = useState<{ x: number; y: number }[]>([]);
  const [hover, setHover] = useState<RegimePoint | null>(null);
  const trailCode = useRef(selected);
  useEffect(() => {
    const p = points.find((p) => p.code === selected);
    if (!p) {
      setTrail([]);
      return;
    }
    const next = {
      x: 64 + p.growth_percentile * 6.72,
      y: 35 + (100 - p.inflation_percentile) * 3.7,
    };
    const changed = trailCode.current !== selected;
    trailCode.current = selected;
    setTrail((t) =>
      changed
        ? [next]
        : t.at(-1)?.x === next.x && t.at(-1)?.y === next.y
          ? t
          : [...t, next].slice(-5),
    );
  }, [period, selected, points]);
  return (
    <section className="central-view regime-view">
      <div className="view-head">
        <div>
          <span className="eyebrow">GROWTH × INFLATION</span>
          <h1>The regime landscape</h1>
        </div>
        <UniverseSelector value={universe} onChange={onUniverse} />
      </div>
      <div className="regime-canvas">
        <div className="quad-label q1">STAGFLATION</div>
        <div className="quad-label q2">OVERHEATING</div>
        <div className="quad-label q3">SLOWDOWN</div>
        <div className="quad-label q4">EXPANSION</div>
        <div className="axis-y-title">HIGHER INFLATION STATE ↑</div>
        <div className="axis-x-title">STRONGER GROWTH STATE →</div>
        <div className="axis-line-y" />
        <div className="axis-line-x" />
        {[25, 75].map((x) => (
          <div key={x} className="minor-v" style={{ left: `${x}%` }} />
        ))}
        {[25, 75].map((y) => (
          <div key={y} className="minor-h" style={{ top: `${y}%` }} />
        ))}
        <svg
          className="regime-points"
          viewBox="0 0 800 440"
          preserveAspectRatio="none"
          aria-label="Growth and inflation percentile plane"
        >
          {trail.slice(1).map((p, i) => (
            <line
              key={i}
              className="regime-trail"
              x1={trail[i].x}
              y1={trail[i].y}
              x2={p.x}
              y2={p.y}
              opacity={((i + 1) / trail.length) * 0.4}
            />
          ))}
          {(() => {
            const labels: { x: number; y: number }[] = [];
            return points
              .slice()
              .sort(
                (a, b) =>
                  Number(a.code === selected) - Number(b.code === selected),
              )
              .map((p) => {
                const x = 64 + p.growth_percentile * 6.72,
                  y = 35 + (100 - p.inflation_percentile) * 3.7;
                const lx = x > 650 ? x - 75 : x + 18;
                let ly = y - 8;
                for (let attempt = 0; attempt < 20; attempt++) {
                  if (
                    !labels.some(
                      (l) => Math.abs(l.x - lx) < 85 && Math.abs(l.y - ly) < 30,
                    )
                  )
                    break;
                  ly =
                    y +
                    (attempt % 2 === 0 ? 1 : -1) *
                      (Math.floor(attempt / 2) + 1) *
                      32;
                }
                ly = Math.max(40, Math.min(390, ly));
                labels.push({ x: lx, y: ly });
                return (
                  <RegimePointMark
                    key={p.code}
                    point={p}
                    x={x}
                    y={y}
                    labelX={lx}
                    labelY={ly}
                    selected={selected === p.code}
                    onSelect={onSelect}
                    onHover={setHover}
                  />
                );
              });
          })()}
        </svg>
        <div className="regime-key">
          <span>
            <i className="dot expansion" />
            Expansion
          </span>
          <span>
            <i className="dot overheating" />
            Overheating
          </span>
          <span>
            <i className="dot stagflation" />
            Stagflation
          </span>
          <span>
            <i className="dot slowdown" />
            Slowdown
          </span>
        </div>
      </div>
      {hover && (
        <div className="regime-hover" role="tooltip">
          <strong>{hover.name}</strong>
          <span>
            Growth {hover.growth_percentile} · Inflation{" "}
            {hover.inflation_percentile}
          </span>
          <span>{hover.regime}</span>
        </div>
      )}
      {!points.length && (
        <p className="analytical-empty">
          No classified economies in this universe.
        </p>
      )}
      <div className="analysis-strip">
        <div>
          <span>SELECTED</span>
          <strong>{selected}</strong>
        </div>
        <div>
          <span>X-AXIS</span>
          <strong>Growth percentile</strong>
        </div>
        <div>
          <span>Y-AXIS</span>
          <strong>Inflation percentile</strong>
        </div>
        <div>
          <span>CLASSIFICATION</span>
          <strong>Rule-based, not predictive</strong>
        </div>
      </div>
    </section>
  );
}
