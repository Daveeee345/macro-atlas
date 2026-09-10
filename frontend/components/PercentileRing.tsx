"use client";

export default function PercentileRing({
  value,
  size = 52,
  compact = false,
}: {
  value: number | null | undefined;
  size?: number;
  compact?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className={`percentile-ring ${compact ? "compact" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} />
        {value != null && (
          <circle
            className="ring-value"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct / 100)}
          />
        )}
      </svg>
      <div className="ring-label">
        <strong>{value == null ? "N/A" : `${Math.round(pct)}%`}</strong>
        {!compact && <span>Hist. %ile</span>}
      </div>
    </div>
  );
}
