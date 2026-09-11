"use client";
import { useEffect, useMemo, useState } from "react";
import { nextPlaybackPeriod, periodsForRange } from "@/lib/timeline";
export default function Timeline({
  periods,
  selected,
  onSelect,
  busy = false,
}: {
  periods: string[];
  selected: string | null;
  onSelect: (period: string) => void;
  busy?: boolean;
}) {
  const [playing, setPlaying] = useState(false),
    [range, setRange] = useState(0);
  const visible = useMemo(
    () => periodsForRange(periods, range),
    [periods, range],
  );
  const index = Math.max(0, visible.indexOf(selected || ""));
  const latest = selected === periods.at(-1);
  useEffect(() => {
    if (!playing || busy || !visible.length) return;
    const id = window.setTimeout(() => {
      const next = nextPlaybackPeriod(visible, selected);
      if (!next) {
        setPlaying(false);
        return;
      }
      onSelect(next);
    }, 1100);
    return () => window.clearTimeout(id);
  }, [playing, busy, visible, selected, onSelect]);
  const ticks = Array.from(
    new Map(
      visible
        .filter(
          (p, i) =>
            i === 0 ||
            i === visible.length - 1 ||
            (Number(p.slice(0, 4)) % 2 === 0 && p.endsWith("Q1")),
        )
        .map((p) => [p.slice(0, 4), p]),
    ).values(),
  );
  return (
    <div
      className={`timeline-bar time-machine ${latest ? "latest" : "historical"}`}
    >
      <div className="time-machine-label">
        <span>TIME MACHINE</span>
        <strong>
          {latest ? "Latest observation state" : "Historical state"}{" "}
          <b>{selected?.replace("-", " ") || "—"}</b>
        </strong>
      </div>
      <button
        className="play-btn"
        disabled={!visible.length}
        aria-label={playing ? "Pause playback" : "Play history"}
        aria-pressed={playing}
        onClick={() => {
          if (!playing && index === visible.length - 1) onSelect(visible[0]);
          setPlaying((v) => !v);
        }}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>
      <div className="timeline-track-wrap">
        <div className="timeline-years">
          {ticks.map((p) => (
            <span
              key={p}
              style={{
                left: `${(visible.indexOf(p) / Math.max(1, visible.length - 1)) * 100}%`,
              }}
            >
              {p.slice(0, 4)}
            </span>
          ))}
        </div>
        <input
          aria-label="Historical timeline"
          aria-valuetext={selected?.replace("-", " ")}
          disabled={!visible.length}
          type="range"
          min={0}
          max={Math.max(0, visible.length - 1)}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            onSelect(visible[Number(e.target.value)]);
          }}
        />
        <span className="timeline-update" role="status">
          {busy
            ? "Updating state…"
            : playing
              ? "Playing quarterly observation states"
              : ""}
        </span>
      </div>
      <div className="time-ranges">
        {[
          [4, "1Y"],
          [20, "5Y"],
          [40, "10Y"],
          [0, "MAX"],
        ].map(([n, label]) => (
          <button
            key={label}
            aria-pressed={range === n}
            onClick={() => {
              const size = Number(n);
              setRange(size);
              setPlaying(false);
              const ps = periodsForRange(periods, size);
              if (selected && ps.length && !ps.includes(selected))
                onSelect(ps[0]);
            }}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => {
            setPlaying(false);
            if (periods.length) onSelect(periods[periods.length - 1]);
          }}
          disabled={latest || !periods.length}
        >
          Latest ↗
        </button>
      </div>
    </div>
  );
}
