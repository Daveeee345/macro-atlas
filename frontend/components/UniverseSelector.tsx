"use client";
import { universes, type Universe } from "@/lib/universe";
export default function UniverseSelector({
  value,
  onChange,
  allowCustom = false,
}: {
  value: Universe;
  onChange: (value: Universe) => void;
  allowCustom?: boolean;
}) {
  return (
    <label className="universe-select">
      <span>UNIVERSE</span>
      <select
        aria-label="Country universe"
        value={value}
        onChange={(e) => onChange(e.target.value as Universe)}
      >
        {universes
          .filter((u) => allowCustom || u !== "custom")
          .map((u) => (
            <option key={u} value={u}>
              {u === "all"
                ? "All economies"
                : u === "g20"
                  ? "G20 countries"
                  : u.toUpperCase()}
            </option>
          ))}
      </select>
    </label>
  );
}
