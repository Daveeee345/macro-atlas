"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type {
  CompareResponse,
  CountrySnapshot,
  PolicyPoint,
  RegimePoint,
  SystemStatus,
} from "@/lib/types";
import TopNav from "./TopNav";
import BottomBar from "./BottomBar";
import Timeline from "./Timeline";
import MetricSidebar from "./MetricSidebar";
import RightInspector from "./RightInspector";
import WorldAtlasView from "./WorldAtlasView";
import RegimeView from "./RegimeView";
import PolicyView from "./PolicyView";
import CompareView from "./CompareView";
import CountryDeepDive from "./CountryDeepDive";
import DataView from "./DataView";
import CommandPalette from "./CommandPalette";
import LineageDrawer from "./LineageDrawer";
import { inUniverse, type Universe, type Layer } from "@/lib/universe";

export type MacroView =
  "atlas" | "regimes" | "policy" | "compare" | "country" | "data";

export default function MacroApp({
  view,
  initialCountry = "IDN",
}: {
  view: MacroView;
  initialCountry?: string;
}) {
  const [universe, setUniverse] = useState<Universe>("all");
  const [custom, setCustom] = useState<string[]>(["IDN", "USA"]);
  const [layer, setLayer] = useState<Layer>("state");
  const [busy, setBusy] = useState(true);
  const [snapshotPeriod, setSnapshotPeriod] = useState<string | null>(null);
  const [left, setLeft] = useState("IDN"),
    [right, setRight] = useState("USA");
  const [compareBusy, setCompareBusy] = useState(false);
  const [countries, setCountries] = useState<CountrySnapshot[]>([]);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState<string | null>(null);
  const [selected, setSelected] = useState(initialCountry);
  const [commandOpen, setCommandOpen] = useState(false);
  const [lineage, setLineage] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setSelected(initialCountry), [initialCountry]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.periods(), api.status()])
      .then(([ps, s]) => {
        if (cancelled) return;
        setPeriods(ps);
        setStatus(s);
        if (ps.length) setPeriod(ps[ps.length - 1]);
      })
      .catch(
        (e) =>
          !cancelled && setError(e instanceof Error ? e.message : String(e)),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const timer = window.setTimeout(
      () =>
        api
          .universe(period)
          .then((c) => {
            if (cancelled) return;
            setCountries(c);
            setSnapshotPeriod(
              period || c.find((c) => c.latest_period)?.latest_period || null,
            );
            setError(null);
          })
          .catch((e) => {
            if (!cancelled)
              setError(e instanceof Error ? e.message : String(e));
          })
          .finally(() => {
            if (!cancelled) setBusy(false);
          }),
      100,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [period]);

  useEffect(() => {
    if (view !== "compare") return;
    let cancelled = false;
    setCompareBusy(true);
    api
      .compare(left, right, period)
      .then((c) => {
        if (!cancelled) setCompare(c);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setCompareBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [left, right, period, view]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if (e.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // These are presentation projections of backend-computed fields, not new analytics.
  const regimes = useMemo<RegimePoint[]>(
    () =>
      countries
        .filter(
          (c) =>
            c.metrics.gdp_growth?.percentile != null &&
            c.metrics.inflation?.percentile != null,
        )
        .map((c) => ({
          code: c.code,
          name: c.name,
          growth_percentile: c.metrics.gdp_growth.percentile!,
          inflation_percentile: c.metrics.inflation.percentile!,
          regime: c.regime,
          gdp_weight: c.gdp_weight,
        })),
    [countries],
  );
  const policy = useMemo<PolicyPoint[]>(
    () =>
      countries
        .filter(
          (c) =>
            c.metrics.real_policy_rate?.value != null &&
            c.metrics.policy_rate?.value != null &&
            c.metrics.inflation?.value != null,
        )
        .map((c) => ({
          code: c.code,
          name: c.name,
          real_rate: c.metrics.real_policy_rate.value!,
          policy_rate: c.metrics.policy_rate.value!,
          inflation: c.metrics.inflation.value!,
          real_rate_percentile: c.metrics.real_policy_rate.percentile,
          gdp_weight: c.gdp_weight,
        }))
        .sort((a, b) => b.real_rate - a.real_rate),
    [countries],
  );

  const country = useMemo(
    () =>
      countries.find(
        (c) => c.code === (view === "compare" ? left : selected),
      ) || null,
    [countries, selected, view, left],
  );

  return (
    <main className="app-shell">
      <TopNav
        active={view === "country" ? "atlas" : view}
        onCommand={() => setCommandOpen(true)}
        period={snapshotPeriod}
        latest={periods.at(-1) || null}
        status={status}
      />
      {error && (
        <div className="api-error">
          <strong>DATA REQUEST FAILED</strong>
          <span>{error}</span>
          <code>Previous observations retained. Check the API connection.</code>
        </div>
      )}
      {busy && (
        <div className="sync-status" role="status">
          {countries.length
            ? "UPDATING OBSERVATIONS"
            : "LOADING COUNTRY UNIVERSE & MACRO SERIES"}
          <span>Retrieving available observations</span>
        </div>
      )}
      <div className={`workspace workspace-${view}`} aria-busy={busy}>
        <MetricSidebar
          country={country}
          countries={countries}
          onSelectCountry={view === "compare" ? setLeft : setSelected}
          onLineage={async (indicator) => {
            if (country) {
              try {
                setLineage(await api.lineage(country.code, indicator));
              } catch (e) {
                setError(String(e));
              }
            }
          }}
        />
        {view === "atlas" && (
          <WorldAtlasView
            countries={countries}
            selected={selected}
            onSelect={setSelected}
            layer={layer}
            onLayer={setLayer}
            universe={universe}
            onUniverse={setUniverse}
            custom={custom}
            onCustom={setCustom}
            period={snapshotPeriod}
            busy={busy}
          />
        )}
        {view === "regimes" && (
          <RegimeView
            points={regimes.filter((p) => {
              const c = countries.find((c) => c.code === p.code);
              return c ? inUniverse(c, universe, custom) : false;
            })}
            period={snapshotPeriod}
            universe={universe}
            onUniverse={setUniverse}
            selected={selected}
            onSelect={setSelected}
          />
        )}
        {view === "policy" && (
          <PolicyView
            points={policy.filter((p) => {
              const c = countries.find((c) => c.code === p.code);
              return c ? inUniverse(c, universe, custom) : false;
            })}
            universe={universe}
            onUniverse={setUniverse}
            selected={selected}
            onSelect={setSelected}
          />
        )}
        {view === "compare" && (
          <CompareView
            data={compare}
            countries={countries}
            left={left}
            right={right}
            onLeft={setLeft}
            onRight={setRight}
            busy={compareBusy}
          />
        )}
        {view === "country" && <CountryDeepDive country={country} />}
        {view === "data" && <DataView status={status} countries={countries} />}
        {view === "compare" ? (
          <CompareInspector data={compare} />
        ) : view === "data" ? (
          <DataInspector status={status} />
        ) : (
          <RightInspector
            country={country}
            policy={policy}
            coverageMode={view === "atlas" && layer === "coverage"}
            period={snapshotPeriod}
          />
        )}
      </div>
      <Timeline
        periods={periods}
        selected={period}
        onSelect={setPeriod}
        busy={busy}
      />
      <BottomBar
        status={status}
        mapped={countries.length}
        analytical={
          countries.filter((c) => c.available_indicator_count > 0).length
        }
        historySpan={
          periods.length
            ? `${periods[0].slice(0, 4)}–${periods.at(-1)!.slice(0, 4)}`
            : "—"
        }
      />
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        countries={countries}
      />
      <LineageDrawer data={lineage} onClose={() => setLineage(null)} />
    </main>
  );
}

function CompareInspector({ data }: { data: CompareResponse | null }) {
  const top =
    data?.rows
      .filter((r) => r.spread != null)
      .slice()
      .sort((a, b) => Math.abs(b.spread || 0) - Math.abs(a.spread || 0))
      .slice(0, 4) || [];
  return (
    <aside className="right-inspector contextual">
      <div className="inspector-title">
        <div>
          <strong>COMPARISON SUMMARY</strong>
          <span>
            {data?.left.code || "—"} ↔ {data?.right.code || "—"}
          </span>
        </div>
      </div>
      <div className="context-big">
        <span>LARGEST DIVERGENCE</span>
        <strong>{top[0]?.indicator?.replaceAll("_", " ") || "—"}</strong>
        <b>
          {top[0]?.spread == null
            ? "—"
            : `${top[0].spread >= 0 ? "+" : ""}${top[0].spread.toFixed(2)}pp`}
        </b>
      </div>
      <div className="context-list">
        {top.map((r, i) => (
          <div key={r.indicator}>
            <span>0{i + 1}</span>
            <strong>{r.indicator.replaceAll("_", " ")}</strong>
            <b>
              {r.spread == null
                ? "—"
                : `${r.spread >= 0 ? "+" : ""}${r.spread.toFixed(2)}pp`}
            </b>
          </div>
        ))}
      </div>
      <div className="context-note">
        <strong>METHOD</strong>
        <p>
          All differences are arithmetic. Percentiles are calculated
          independently within each economy&apos;s own history.
        </p>
      </div>
    </aside>
  );
}

function DataInspector({ status }: { status: SystemStatus | null }) {
  return (
    <aside className="right-inspector contextual">
      <div className="inspector-title">
        <div>
          <strong>DATA GOVERNANCE</strong>
          <span>System integrity</span>
        </div>
      </div>
      <div className="context-big">
        <span>VALIDATION</span>
        <strong>
          {!status ? "PENDING" : status.validation_warnings ? "REVIEW" : "PASS"}
        </strong>
        <b>{status?.validation_warnings ?? "—"} warnings</b>
      </div>
      <div className="context-list">
        <div>
          <span>01</span>
          <strong>Observed data</strong>
          <b>stored</b>
        </div>
        <div>
          <span>02</span>
          <strong>Derived metrics</strong>
          <b>deterministic</b>
        </div>
        <div>
          <span>03</span>
          <strong>Forecasting</strong>
          <b>disabled</b>
        </div>
        <div>
          <span>04</span>
          <strong>Lineage</strong>
          <b>exposed</b>
        </div>
      </div>
      <div className="context-note">
        <strong>PRODUCTION RULE</strong>
        <p>
          Replace demo series with verified official mappings before public
          analytical use.
        </p>
      </div>
    </aside>
  );
}
