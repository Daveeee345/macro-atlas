"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { select } from "d3-selection";
import { zoom as createZoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import "d3-transition";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { CountrySnapshot } from "@/lib/types";
import {
  inUniverse,
  layers,
  layerColor,
  layerValue,
  legend,
  tierName,
  type Layer,
  type Universe,
} from "@/lib/universe";
import UniverseSelector from "./UniverseSelector";

const projection = geoNaturalEarth1().scale(172).translate([540, 290]);
const geo = geoPath(projection);
const W = 1080,
  H = 590;
const motionDuration = (ms: number) =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
const peerOrder = ["USA", "CHN", "JPN", "IND", "EUR", "GBR", "BRA", "IDN"];
const aliases: Record<string, string> = {
  "N. Cyprus": "Northern Cyprus",
  Somaliland: "Somaliland",
  Kosovo: "Kosovo",
};
export default function WorldAtlasView({
  countries,
  selected,
  onSelect,
  layer,
  onLayer,
  universe,
  onUniverse,
  custom,
  onCustom,
  period,
  busy,
}: {
  countries: CountrySnapshot[];
  selected: string;
  onSelect: (code: string) => void;
  layer: Layer;
  onLayer: (layer: Layer) => void;
  universe: Universe;
  onUniverse: (u: Universe) => void;
  custom: string[];
  onCustom: (codes: string[]) => void;
  period: string | null;
  busy: boolean;
}) {
  const [land, setLand] = useState<FeatureCollection<Geometry> | null>(null);
  const [failed, setFailed] = useState(false),
    [hovered, setHovered] = useState<string | null>(null),
    [links, setLinks] = useState(false),
    [labels, setLabels] = useState(true),
    [level, setLevel] = useState(1),
    [customSearch, setCustomSearch] = useState("");
  const svgRef = useRef<SVGSVGElement>(null),
    groupRef = useRef<SVGGElement>(null),
    zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const previous = useRef(selected);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/maps/countries-110m.json", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((t: Topology<{ countries: GeometryCollection }>) =>
        setLand(feature(t, t.objects.countries)),
      )
      .catch((e) => {
        if (e.name !== "AbortError") setFailed(true);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!svgRef.current || !groupRef.current) return;
    const svg = select(svgRef.current),
      group = select(groupRef.current);
    const behavior = createZoom<SVGSVGElement, unknown>()
      .extent([
        [0, 0],
        [W, H],
      ])
      .scaleExtent([1, 5])
      .translateExtent([
        [-80, -60],
        [W + 80, H + 60],
      ])
      .on("start", () => group.classed("map-moving", true))
      .on("zoom", (event) =>
        group.attr("transform", event.transform.toString()),
      )
      .on("end", (event) => {
        group.classed("map-moving", false);
        setLevel(event.transform.k);
      });
    zoomRef.current = behavior;
    svg.call(behavior).on("dblclick.zoom", null);
    return () => {
      svg.interrupt();
      svg.on(".zoom", null);
      zoomRef.current = null;
    };
  }, []);
  const move = useCallback(
    (code?: string) => {
      if (!svgRef.current || !zoomRef.current) return;
      const c = countries.find((c) => c.code === code);
      const p = c ? projection([c.lon, c.lat]) : null;
      const k = p ? 1.65 : 1;
      const x = p
        ? Math.max(W - W * k - 80, Math.min(80, W / 2 - p[0] * k))
        : 0;
      const y = p
        ? Math.max(H - H * k - 60, Math.min(60, H / 2 - p[1] * k))
        : 0;
      const transform = zoomIdentity.translate(x, y).scale(k);
      select(svgRef.current)
        .transition()
        .duration(
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? 0
            : 650,
        )
        .call(zoomRef.current.transform, transform);
    },
    [countries],
  );
  useEffect(() => {
    if (previous.current !== selected) {
      previous.current = selected;
      move(selected);
    }
  }, [selected, move]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        move();
        setHovered(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [move]);
  const shapes = useMemo(
    () =>
      land?.features.map((f, index) => ({
        id: String(f.id ?? `shape-${index}`),
        numeric: f.id == null ? null : String(f.id).padStart(3, "0"),
        name: String(f.properties?.name || "Geographic territory"),
        d: geo(f) || "",
      })) || [],
    [land],
  );
  const byNumeric = useMemo(
    () =>
      new Map(
        countries.filter((c) => c.numeric_code).map((c) => [c.numeric_code, c]),
      ),
    [countries],
  );
  const byName = useMemo(
    () => new Map(countries.map((c) => [c.name, c])),
    [countries],
  );
  const nodes = useMemo(
    () => countries.map((c) => ({ c, p: projection([c.lon, c.lat])! })),
    [countries],
  );
  const active = countries.find((c) => c.code === selected),
    hover = countries.find((c) => c.code === hovered);
  const included = useMemo(
    () =>
      new Set(
        countries
          .filter((c) => inUniverse(c, universe, custom))
          .map((c) => c.code),
      ),
    [countries, universe, custom],
  );
  const visibleNodes = nodes.filter(
    ({ c }) =>
      c.available_indicator_count > 0 &&
      (included.has(c.code) || c.code === selected) &&
      (c.tier === 1 ||
        level >= 1.6 ||
        c.code === selected ||
        c.code === hovered),
  );
  const annotations = useMemo(() => {
    if (!labels)
      return nodes
        .filter((n) => n.c.code === selected || n.c.code === hovered)
        .map((n) => ({ ...n, dx: 12, dy: -12 }));
    const candidates = nodes.filter(
      ({ c }) =>
        c.code === selected ||
        c.code === hovered ||
        (included.has(c.code) &&
          (c.tier === 1 || (level >= 2 && c.tier === 2) || level >= 3.5)),
    );
    candidates.sort(
      (a, b) =>
        Number(b.c.code === selected) * 100 +
        Number(b.c.code === hovered) * 50 +
        b.c.available_indicator_count -
        (Number(a.c.code === selected) * 100 +
          Number(a.c.code === hovered) * 50 +
          a.c.available_indicator_count),
    );
    const boxes: { x: number; y: number; w: number; h: number }[] = [];
    const output: {
      c: CountrySnapshot;
      p: number[];
      dx: number;
      dy: number;
    }[] = [];
    for (const node of candidates) {
      const { c, p } = node;
      const width = Math.min(175, c.name.length * 9) / level,
        height = (level > 2 ? 46 : 30) / level;
      const offsets = [
        [13, -12],
        [13, 27],
        [-width - 13, -12],
        [-width - 13, 27],
        [13, -45],
      ];
      for (const [dx0, dy0] of offsets) {
        const dx = dx0 / Math.sqrt(level),
          dy = dy0 / Math.sqrt(level),
          box = {
            x: p[0] + dx,
            y: p[1] + dy - 13 / level,
            w: width,
            h: height,
          };
        if (
          !boxes.some(
            (b) =>
              box.x < b.x + b.w + 8 / level &&
              box.x + box.w + 8 / level > b.x &&
              box.y < b.y + b.h + 5 / level &&
              box.y + box.h + 5 / level > b.y,
          )
        ) {
          boxes.push(box);
          output.push({ ...node, dx, dy });
          break;
        }
      }
    }
    return output;
  }, [nodes, labels, selected, hovered, included, level]);
  const arcs = useMemo(
    () =>
      active && active.available_indicator_count > 0
        ? visibleNodes
            .filter((n) => n.c.code !== selected)
            .sort(
              (a, b) =>
                (peerOrder.indexOf(a.c.code) < 0
                  ? 99
                  : peerOrder.indexOf(a.c.code)) -
                (peerOrder.indexOf(b.c.code) < 0
                  ? 99
                  : peerOrder.indexOf(b.c.code)),
            )
            .slice(0, 4)
            .map((n) => ({
              code: n.c.code,
              d:
                geo({
                  type: "LineString",
                  coordinates: [
                    [active.lon, active.lat],
                    [n.c.lon, n.c.lat],
                  ],
                }) || "",
            }))
        : [],
    [active, visibleNodes, selected],
  );
  const choose = (code: string) => {
    onSelect(code);
    setHovered(null);
    if (code === selected) move(code);
  };
  return (
    <section className="central-view atlas-view atlas-global">
      <div className="view-head">
        <div>
          <span className="eyebrow">GLOBAL MACRO INTELLIGENCE</span>
          <h1>
            A world of perspectives
            <span className="heading-period">{period?.replace("-", " ")}</span>
          </h1>
        </div>
        <button
          className={`comparison-toggle ${links ? "active" : ""}`}
          aria-pressed={links}
          onClick={() => setLinks((v) => !v)}
        >
          ⌁ Comparison links
        </button>
      </div>
      <div className="atlas-toolbar">
        <UniverseSelector allowCustom value={universe} onChange={onUniverse} />
        <div className="atlas-layers" aria-label="Analytical layer">
          {layers.map((l) => (
            <button
              key={l.id}
              aria-pressed={layer === l.id}
              onClick={() => onLayer(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      {universe === "custom" && (
        <div className="custom-universe">
          <input
            aria-label="Find custom economy"
            placeholder="Find an economy…"
            value={customSearch}
            onChange={(e) => setCustomSearch(e.target.value)}
          />
          <div>
            {countries
              .filter((c) =>
                c.name.toLowerCase().includes(customSearch.toLowerCase()),
              )
              .slice(0, 12)
              .map((c) => (
                <label key={c.code}>
                  <input
                    type="checkbox"
                    checked={custom.includes(c.code)}
                    onChange={(e) =>
                      onCustom(
                        e.target.checked
                          ? [...custom, c.code]
                          : custom.filter((x) => x !== c.code),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
          </div>
          <span>{custom.length} selected</span>
        </div>
      )}
      <div className="atlas-subhead">
        <span>
          <i className="status-dot" />
          {included.size} in universe ·{" "}
          {
            countries.filter(
              (c) => included.has(c.code) && c.available_indicator_count > 0,
            ).length
          }{" "}
          with analytics
        </span>
        <span role="status">
          {busy ? "Updating observations…" : "Geography ≠ analytical coverage"}
        </span>
      </div>
      <div
        className={`geographic-canvas ${hovered ? "has-country-hover" : ""}`}
      >
        {!land && (
          <div className="map-loading" role="status">
            {failed
              ? "Geography unavailable. Reload to retry."
              : "MAPPING ECONOMIES · Loading Natural Earth boundaries"}
          </div>
        )}
        <svg
          ref={svgRef}
          className="atlas-geography"
          viewBox={`0 0 ${W} ${H}`}
          aria-label="Interactive world macro map. Drag to pan, scroll to zoom. Escape returns to global view."
        >
          <defs>
            <pattern
              id="unavailable-map"
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
            >
              <path d="M0 5L5 0" stroke="#d9e0e5" strokeWidth=".4" />
            </pattern>
          </defs>
          <g ref={groupRef}>
            {shapes.map((s) => {
              const c =
                (s.numeric ? byNumeric.get(s.numeric) : undefined) ||
                byName.get(aliases[s.name] || s.name);
              const chosen = c?.code === selected,
                over = c?.code === hovered;
              return (
                <path
                  key={s.id}
                  d={s.d}
                  role={c ? "button" : undefined}
                  tabIndex={c ? 0 : undefined}
                  aria-label={
                    c
                      ? `${c.name}, Tier ${c.tier}, ${c.coverage_score}% data coverage. Select country`
                      : s.name
                  }
                  aria-pressed={chosen}
                  className={`land-country ${chosen ? "is-selected" : ""} ${over ? "is-hovered" : ""}`}
                  style={{
                    fill: c ? layerColor(c, layer) : "#eef1f3",
                    fillOpacity:
                      c?.available_indicator_count && layer !== "coverage"
                        ? 0.22
                        : 1,
                    opacity:
                      c && !included.has(c.code) && !chosen
                        ? 0.22
                        : hovered && !over && !chosen
                          ? 0.52
                          : 1,
                  }}
                  onPointerEnter={() => c && setHovered(c.code)}
                  onPointerLeave={() => setHovered(null)}
                  onFocus={() => c && setHovered(c.code)}
                  onBlur={() => setHovered(null)}
                  onClick={() => c && choose(c.code)}
                  onKeyDown={(e) => {
                    if (c && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      choose(c.code);
                    }
                  }}
                >
                  <title>
                    {c
                      ? `${c.name} · Tier ${c.tier} · ${c.coverage_score}% coverage`
                      : s.name}
                  </title>
                </path>
              );
            })}
            {links &&
              arcs.map((arc, i) => (
                <g key={arc.code} className="comparison-arc">
                  <path className="geo-link" d={arc.d} />
                  <path
                    className={`link-flow ${i < 2 ? "flow-active" : ""}`}
                    d={arc.d}
                  />
                </g>
              ))}
            {visibleNodes.map(({ c, p }) => (
              <g
                key={c.code}
                transform={`translate(${p[0]},${p[1]})`}
                className={`geo-node tier-${c.tier} ${c.code === selected ? "selected" : ""}`}
                style={{
                  color: layerColor(c, layer),
                  opacity: hovered && hovered !== c.code ? 0.45 : 1,
                }}
                onPointerEnter={() => setHovered(c.code)}
                onPointerLeave={() => setHovered(null)}
                onClick={() => choose(c.code)}
                role="button"
                tabIndex={0}
                aria-label={`${c.name} analytical marker`}
                aria-pressed={c.code === selected}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose(c.code);
                  }
                }}
              >
                <g transform={`scale(${1 / Math.sqrt(level)})`}>
                  <circle className="node-hit" r="13" />
                  {c.code === selected && (
                    <>
                      <circle className="selected-breath" r="12" />
                      <circle
                        key={`${c.code}-${period}`}
                        className="history-ripple"
                        r="9"
                      />
                    </>
                  )}
                  <circle
                    className="coverage-node-ring"
                    r="8"
                    pathLength="100"
                    strokeDasharray={`${c.coverage_score} 100`}
                    transform="rotate(-90)"
                  />
                  <circle
                    className="node-core"
                    r={c.code === selected ? 4.7 : c.tier === 1 ? 3.5 : 2.7}
                  />
                </g>
              </g>
            ))}
            {annotations.map(({ c, p, dx, dy }) => (
              <g
                key={`label-${c.code}`}
                className={`map-annotation ${c.code === selected ? "selected" : ""}`}
                transform={`translate(${p[0]},${p[1]})`}
                onClick={() => choose(c.code)}
                onPointerEnter={() => setHovered(c.code)}
                onPointerLeave={() => setHovered(null)}
              >
                <line x2={dx} y2={dy} stroke="#b9c5d0" strokeWidth=".45" />
                <g
                  transform={`translate(${dx},${dy}) scale(${1 / Math.sqrt(level)})`}
                >
                  <text className="geo-label">{c.name}</text>
                  <text className="geo-value" y="16">
                    {c.available_indicator_count > 0
                      ? layerValue(c, layer)
                      : "No analytics"}
                  </text>
                  {level > 2 && (
                    <text className="geo-detail" y="31">
                      {c.code} · Tier {c.tier} · {c.coverage_score}% covered
                    </text>
                  )}
                </g>
              </g>
            ))}
          </g>
        </svg>
        {hover && (
          <div className="country-tooltip" role="tooltip">
            <div>
              <strong>{hover.name}</strong>
              <span>{hover.code}</span>
            </div>
            <p>
              Tier {hover.tier} · {tierName(hover.tier)} · {hover.entity_type}
            </p>
            <dl>
              <div>
                <dt>Data coverage</dt>
                <dd>
                  {hover.coverage_score}%{" "}
                  <small>
                    ({hover.available_indicator_count}/
                    {hover.required_indicator_count})
                  </small>
                </dd>
              </div>
              <div>
                <dt>{layers.find((l) => l.id === layer)?.label}</dt>
                <dd>{layerValue(hover, layer)}</dd>
              </div>
            </dl>
            <footer>
              {included.has(hover.code)
                ? "Click to inspect economy"
                : "Outside selected universe · click to inspect"}
            </footer>
          </div>
        )}
        <div className="geo-controls">
          <button
            aria-label="Zoom in"
            disabled={level >= 4.95}
            onClick={() => {
              if (svgRef.current && zoomRef.current)
                select(svgRef.current)
                  .transition()
                  .duration(motionDuration(250))
                  .call(zoomRef.current.scaleBy, 1.4);
            }}
          >
            +
          </button>
          <button
            aria-label="Zoom out"
            disabled={level <= 1.01}
            onClick={() => {
              if (svgRef.current && zoomRef.current)
                select(svgRef.current)
                  .transition()
                  .duration(motionDuration(250))
                  .call(zoomRef.current.scaleBy, 1 / 1.4);
            }}
          >
            −
          </button>
          <button aria-label="Reset map" onClick={() => move()}>
            ↺
          </button>
        </div>
        <div className="geo-label-control">
          <label>
            <input
              type="checkbox"
              checked={labels}
              onChange={(e) => setLabels(e.target.checked)}
            />{" "}
            Labels
          </label>
          <span>Drag to pan · Scroll to zoom · Esc reset</span>
        </div>
      </div>
      <div className="atlas-map-footer">
        <div className="growth-legend">
          <strong>
            {layers.find((l) => l.id === layer)?.label.toUpperCase()}
          </strong>
          {legend(layer).map(([color, label]) => (
            <span key={label}>
              <i className="lg" style={{ background: color }} />
              {label}
            </span>
          ))}
          <span className="encoding-note">Rings = coverage</span>
        </div>
        <span>Natural Earth 1</span>
      </div>
      <div className="atlas-focus">
        <div>
          <span className="eyebrow">IN FOCUS / TIER {active?.tier}</span>
          <strong>
            {active?.name || "Mapping economies…"} <small>{selected}</small>
          </strong>
        </div>
        <div>
          <span>Available indicators</span>
          <b>
            {active
              ? `${active.available_indicator_count} / ${active.required_indicator_count}`
              : "—"}
          </b>
        </div>
        <div>
          <span>Data coverage</span>
          <b>{active ? `${active.coverage_score}%` : "—"}</b>
        </div>
        <Link href={`/country/${selected}`}>Country research ↗</Link>
      </div>
      {links && (
        <p className="network-note">
          Comparison links · selected economy to up to four covered peers. No
          exposure, causality, or shock transmission is implied.
        </p>
      )}
    </section>
  );
}
