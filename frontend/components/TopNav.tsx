"use client";
import Image from "next/image";
import Link from "next/link";
import type { SystemStatus } from "@/lib/types";
import { SearchIcon } from "./Icons";

const links = [
  ["ATLAS", "/", "atlas"],
  ["REGIMES", "/regimes", "regimes"],
  ["POLICY", "/policy", "policy"],
  ["COMPARE", "/compare", "compare"],
  ["DATA", "/data", "data"],
] as const;

export default function TopNav({
  active,
  onCommand,
  period,
  latest,
  status,
}: {
  period: string | null;
  latest: string | null;
  status: SystemStatus | null;
  active: string;
  onCommand: () => void;
}) {
  return (
    <header className="top-nav">
      <Link className="brand" href="/" aria-label="MacroAtlas home">
        <Image
          className="brand-logo"
          src="/brand/macro-atlas-wordmark.png"
          alt="MacroAtlas"
          width={2150}
          height={571}
          priority
        />
      </Link>
      <nav className="nav-links">
        {links.map(([label, href, id]) => (
          <Link key={id} className={active === id ? "active" : ""} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <button className="global-search" onClick={onCommand}>
        <SearchIcon />
        <span>Search economies & tools</span>
        <kbd>⌘ K</kbd>
      </button>
      <Link href="/data" className="nav-date">
        <strong>
          {period && period !== latest
            ? `AS OF ${period.replace("-", " ")}`
            : period
              ? "DATA CURRENT"
              : "CONNECTING DATA"}
        </strong>
        <span>
          <i />
          {status?.mode === "DEMO_SNAPSHOT"
            ? "Synthetic demo"
            : status?.mode === "LIVE_OFFICIAL"
              ? "Observed macro data"
              : "Awaiting official data"}
        </span>
      </Link>
      <div className="avatar">MA</div>
    </header>
  );
}
