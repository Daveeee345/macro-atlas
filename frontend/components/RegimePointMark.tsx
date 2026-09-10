"use client";
import { useEffect, useRef } from "react";
import { select } from "d3-selection";
import "d3-transition";
import type { RegimePoint } from "@/lib/types";
/** D3 interpolates SVG attributes; React retains identity and interaction state. */
export default function RegimePointMark({
  point,
  x,
  y,
  labelX,
  labelY,
  selected,
  onSelect,
  onHover,
}: {
  point: RegimePoint;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  selected: boolean;
  onSelect: (code: string) => void;
  onHover: (point: RegimePoint | null) => void;
}) {
  const ref = useRef<SVGGElement>(null),
    initialized = useRef(false);
  useEffect(() => {
    if (!ref.current) return;
    const group = select(ref.current);
    const duration =
      !initialized.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 750;
    group
      .select("circle")
      .interrupt()
      .transition()
      .duration(duration)
      .attr("cx", x)
      .attr("cy", y)
      .attr("r", selected ? 8 : 5);
    group
      .select("line")
      .interrupt()
      .transition()
      .duration(duration)
      .attr("x1", x)
      .attr("y1", y)
      .attr("x2", labelX)
      .attr("y2", labelY + 4);
    group
      .select(".regime-code")
      .interrupt()
      .transition()
      .duration(duration)
      .attr("x", labelX)
      .attr("y", labelY);
    group
      .select(".regime-coordinate")
      .interrupt()
      .transition()
      .duration(duration)
      .attr("x", labelX)
      .attr("y", labelY + 14);
    initialized.current = true;
    return () => {
      group.selectAll("*").interrupt();
    };
  }, [x, y, labelX, labelY, selected]);
  return (
    <g
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={`Select ${point.name}`}
      aria-pressed={selected}
      className={`regime-point ${point.regime.toLowerCase()} ${selected ? "selected" : ""}`}
      onPointerEnter={() => onHover(point)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(point)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(point.code)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(point.code);
        }
      }}
    >
      <line />
      <circle />
      <text className="regime-code">{point.code}</text>
      <text className="regime-coordinate">
        G {Math.round(point.growth_percentile)} · I{" "}
        {Math.round(point.inflation_percentile)}
      </text>
    </g>
  );
}
