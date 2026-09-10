import type { CountrySnapshot } from "@/lib/types";
import { indicatorLabels, tierName } from "@/lib/universe";
export default function DataCoveragePanel({
  country,
  compact = false,
}: {
  country: CountrySnapshot;
  compact?: boolean;
}) {
  return (
    <section className={`coverage-panel ${compact ? "compact" : ""}`}>
      <div className="section-label">
        DATA COVERAGE · TIER {country.tier} / {tierName(country.tier)}
      </div>
      <div className="coverage-headline">
        <strong>
          {country.coverage_score}
          <small>%</small>
        </strong>
        <span>
          {country.available_indicator_count} /{" "}
          {country.required_indicator_count} indicators
          <br />
          {country.data_status.toLowerCase()}
        </span>
      </div>
      <div className="coverage-track">
        <i style={{ width: `${country.coverage_score}%` }} />
      </div>
      <p>
        Availability of required indicators. Not a measure of economic strength.
      </p>
      {!compact && (
        <>
          <div className="coverage-columns">
            <div>
              <h3>AVAILABLE · {country.available_indicators.length}</h3>
              {country.available_indicators.length ? (
                country.available_indicators.map((id) => (
                  <p key={id}>
                    <i className="availability-dot" />
                    {indicatorLabels[id]}
                    <small>{country.metrics[id]?.period}</small>
                  </p>
                ))
              ) : (
                <p>No valid observations</p>
              )}
            </div>
            <div>
              <h3>UNAVAILABLE · {country.unavailable_indicators.length}</h3>
              {country.unavailable_indicators.map((id) => (
                <p key={id}>
                  <i className="availability-dot missing" />
                  {indicatorLabels[id]}
                </p>
              ))}
            </div>
          </div>
          <p className="coverage-method">
            Based on valid latest available observations at or before the
            selected period. Older observations may be carried forward; coverage
            does not measure freshness. Existing synthetic series remain labeled
            as demo data.
          </p>
        </>
      )}
    </section>
  );
}
