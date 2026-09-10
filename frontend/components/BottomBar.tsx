import type { SystemStatus } from "@/lib/types";
import { ClockIcon, DatabaseIcon, GlobeIcon, TrendIcon } from "./Icons";

export default function BottomBar({
  status,
  mapped,
  analytical,
  historySpan,
}: {
  status: SystemStatus | null;
  mapped: number;
  analytical: number;
  historySpan: string;
}) {
  return (
    <div className="bottom-status">
      <div className="bottom-brand">
        <strong>MACRO ATLAS</strong>
        <span>Observed data · Deterministic analytics</span>
      </div>
      <div className="system-metric">
        <GlobeIcon />
        <strong>{mapped || "—"}</strong>
        <span>Mapped</span>
      </div>
      <div className="system-metric">
        <strong>{mapped ? analytical : "—"}</strong>
        <span>With analytics</span>
      </div>
      <div className="system-metric">
        <DatabaseIcon />
        <strong>{status?.series ?? "—"}</strong>
        <span>Series</span>
      </div>
      <div className="system-metric">
        <ClockIcon />
        <strong>{historySpan}</strong>
        <span>History</span>
      </div>
      <div className="system-metric">
        <TrendIcon />
        <strong>
          {!status ? "—" : status.validation_warnings ? "Review" : "Pass"}
        </strong>
        <span>Validated</span>
      </div>
      <div className="no-forecast">
        <span className="no-symbol">⌀</span>
        <div>
          <strong>NO FORECASTING</strong>
          <span>Observed & deterministic metrics</span>
        </div>
      </div>
    </div>
  );
}
