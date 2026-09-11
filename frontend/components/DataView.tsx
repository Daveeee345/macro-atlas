"use client";
import type { CountrySnapshot, SystemStatus } from "@/lib/types";

export default function DataView({
  status,
  countries,
}: {
  status: SystemStatus | null;
  countries: CountrySnapshot[];
}) {
  const analytical = countries.filter(
    (c) => c.available_indicator_count > 0,
  ).length;
  const distribution = ["FULL", "GOOD", "PARTIAL", "LIMITED", "UNAVAILABLE"];
  const latest = countries.flatMap((c) =>
    Object.entries(c.metrics)
      .filter(([id]) =>
        [
          "gdp_growth",
          "inflation",
          "policy_rate",
          "gov_10y",
          "current_account",
          "debt_gdp",
          "private_credit_gdp",
        ].includes(id),
      )
      .filter(([, m]) => m.value != null)
      .map(([id, m]) => ({ country: c.code, id, m })),
  );
  const exportRegister = () => {
    const rows = [
      ["country", "indicator", "value", "period", "source", "status"],
      ...latest.map(({ country, id, m }) => [
        country,
        id,
        m.value,
        m.period,
        m.source,
        m.validation_status,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((v) => '"' + String(v ?? "").replaceAll('"', '""') + '"')
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "macro-atlas-register.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="central-view data-view">
      <div className="view-head">
        <div>
          <span className="eyebrow">COVERAGE & LINEAGE</span>
          <h1>Data observatory</h1>
        </div>
        <div className="view-badge">{status?.mode === "LIVE_OFFICIAL" ? "OFFICIAL DATA" : "DATA UNAVAILABLE"}</div>
      </div>
      <section className="global-coverage">
        <div>
          <span className="eyebrow">
            GLOBAL COVERAGE / ANALYTICAL ECONOMIES
          </span>
          <div className="coverage-totals">
            <div>
              <strong>{countries.length || "—"}</strong>
              <span>Analytical economies</span>
            </div>
            <div>
              <strong>{countries.length ? analytical : "—"}</strong>
              <span>With ≥1 observation</span>
            </div>
            {[1, 2, 3].map((t) => (
              <div key={t}>
                <strong>
                  {countries.length
                    ? countries.filter((c) => c.tier === t).length
                    : "—"}
                </strong>
                <span>Tier {t}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="coverage-distribution">
          {distribution.map((status) => (
            <div key={status}>
              <span>{status.toLowerCase()}</span>
              <div>
                <i
                  style={{
                    width: `${countries.length ? (countries.filter((c) => c.data_status === status).length / countries.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <b>{countries.filter((c) => c.data_status === status).length}</b>
            </div>
          ))}
        </div>
        <p>
          Coverage counts valid required indicators available at or before the
          selected period. It does not measure freshness, economic strength, or
          risk.
        </p>
      </section>
      <div className="data-top-grid">
        <div className="data-block">
          <div className="section-label">SYSTEM STATUS</div>
          <div className="big-system-number">
            {status?.series || 0}
            <span>series</span>
          </div>
          <div className="data-lines">
            <p>
              <span>Economies</span>
              <b>{status?.countries || 0}</b>
            </p>
            <p>
              <span>Observations</span>
              <b>{status?.observations?.toLocaleString() || 0}</b>
            </p>
            <p>
              <span>Validation warnings</span>
              <b>{status?.validation_warnings || 0}</b>
            </p>
            <p>
              <span>Mode</span>
              <b>{status?.mode === "LIVE_OFFICIAL" ? "Official production" : "Unavailable"}</b>
            </p>
          </div>
        </div>
        <div className="data-block">
          <div className="section-label">DATA SOURCE ARCHITECTURE</div>
          <div className="source-flow">
            <div>
              WORLD BANK<span>WDI Indicators V2</span>
            </div>
            <div>
              BIS<span>awaiting verified mapping</span>
            </div>
            <div>
              FRED<span>optional approved mappings</span>
            </div>
            <i>→</i>
            <div className="flow-core">
              NORMALIZE<span>validate · store</span>
            </div>
            <i>→</i>
            <div className="flow-core">
              ANALYTICS<span>percentile · regime</span>
            </div>
          </div>
          <p className="data-disclaimer">
            {status?.providers?.length
              ? status.providers.map((provider) => `${provider.source}: ${provider.countries} economies · ${provider.series} indicators · ${provider.observations.toLocaleString()} observations`).join("  /  ")
              : "No official provider observations are currently available."}
          </p>
        </div>
      </div>
      <div className="data-table-title">
        <div>
          <span className="section-label">OBSERVATION REGISTER</span>
          <p>
            Every production value should expose period, source and validation
            status.
          </p>
        </div>
        <button onClick={exportRegister} disabled={!latest.length}>
          EXPORT CSV ↗
        </button>
      </div>
      <div className="data-table">
        <div className="data-tr head">
          <span>COUNTRY</span>
          <span>INDICATOR</span>
          <span>VALUE</span>
          <span>PERIOD</span>
          <span>SOURCE</span>
          <span>STATUS</span>
        </div>
        {latest.map(({ country, id, m }) => (
          <div className="data-tr" key={`${country}-${id}`}>
            <b>{country}</b>
            <span>{id.replaceAll("_", " ")}</span>
            <strong>
              {m.value == null ? "N/A" : `${m.value.toFixed(2)}%`}
            </strong>
            <span>{m.period}</span>
            <span>{m.source}</span>
            <span className="status-ok">● {m.validation_status}</span>
          </div>
        ))}
      </div>
      <div className="method-grid">
        <div>
          <strong>HISTORICAL PERCENTILE</strong>
          <p>
            Current observation&apos;s empirical rank within its trailing 10
            calendar years, with no future observations.
          </p>
        </div>
        <div>
          <strong>REAL POLICY RATE</strong>
          <p>
            Policy rate minus headline CPI inflation. Ex-post descriptive
            measure.
          </p>
        </div>
        <div>
          <strong>REGIME CLASSIFICATION</strong>
          <p>
            Growth percentile × inflation percentile using transparent median
            thresholds.
          </p>
        </div>
        <div>
          <strong>NO FORECASTING</strong>
          <p>
            No causal estimates, price targets or future macro predictions are
            produced.
          </p>
        </div>
      </div>
    </section>
  );
}
