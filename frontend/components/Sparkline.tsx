"use client";
import type { HistoryPoint } from "@/lib/types";

export default function Sparkline({ history, width = 185, height = 38 }: { history: HistoryPoint[]; width?: number; height?: number }) {
  if (!history?.length) return <div className="spark-empty" />;
  const values = history.map(p => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const points = history.map((p, i) => {
    const x = (i / Math.max(1, history.length - 1)) * width;
    const y = height - ((p.value - min) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="sparkline" width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={`M0 ${height-3} H${width}`} className="spark-base" />
      <polyline points={points} fill="none" className="spark-path" />
      <circle cx={width} cy={Number(points.split(" ").at(-1)?.split(",")[1] || height/2)} r="2.5" className="spark-dot" />
    </svg>
  );
}
