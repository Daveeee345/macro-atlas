import { MacroService } from "./service";
import { PostgresRepository } from "./repository";

type ApiRepository = Pick<PostgresRepository, "dataset" | "lineage" | "systemStatus">;

export async function handleApi(request: Request, repository: ApiRepository = new PostgresRepository()): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "GET") return json({ detail: "Method not allowed" }, 405);
  const url = new URL(request.url);
  const path = apiPath(url.pathname);
  try {
    if (path === "/health") return json({ status: "ok", storage: "supabase-postgresql", runtime: "netlify-functions" });
    if (path === "/system/status") {
      const status = await repository.systemStatus();
      return json({ ...status,
        mode: Number(status.observations) > 0 ? "LIVE_OFFICIAL" : "EMPTY_PRODUCTION",
        data_label: Number(status.observations) > 0 ? "Observed official macro data" : "No production observations loaded",
        generated_at: new Date().toISOString(),
      });
    }
    const service = new MacroService(await repository.dataset());
    const period = url.searchParams.get("period");
    if (path === "/countries" || path === "/universe") {
      const universe = url.searchParams.get("universe");
      const tier = optionalNumber(url, "tier", 1, 3);
      const coverageMin = optionalNumber(url, "coverage_min", 0, 100) ?? 0;
      const region = url.searchParams.get("region");
      const filtered = path === "/universe" || universe || tier != null || region || coverageMin > 0;
      const countries = filtered ? service.universe(period, universe || "all", tier, region, coverageMin) : service.allSnapshots(period);
      return json(path === "/universe" ? countries.map(compactSnapshot) : countries);
    }
    if (path === "/coverage") return json(service.coverageSummary(period));
    if (path === "/regimes") return json(service.regimeMap(period));
    if (path === "/policy") return json(service.policyMap(period));
    if (path === "/periods") return json(service.availablePeriods());
    if (path === "/timeline") return json(service.timeline());
    if (path === "/compare") return json(service.compare(
      (url.searchParams.get("left") || "IDN").toUpperCase(),
      (url.searchParams.get("right") || "USA").toUpperCase(), period,
    ));
    const countryMatch = path.match(/^\/countries\/([A-Za-z0-9_-]+)$/);
    if (countryMatch) return json(service.countrySnapshot(countryMatch[1], period));
    const lineageMatch = path.match(/^\/lineage\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/);
    if (lineageMatch) {
      const code = lineageMatch[1].toUpperCase();
      const indicator = lineageMatch[2];
      const record = await repository.lineage(code, indicator);
      if (!record) return json({ detail: "Lineage not found" }, 404);
      return json({ ...record,
        derived: { historical_percentile: service.metricSummary(code, indicator).percentile,
          historical_window: "Trailing 10 calendar years ending at the displayed observation date; no future observations" },
        methodology: "Observed data plus deterministic transformations. No forecasting or causal estimation.",
      });
    }
    return json({ detail: "Not found" }, 404);
  } catch (error) {
    if (error instanceof RangeError) return json({ detail: error.message }, 422);
    if (error instanceof Error && error.message === "NOT_FOUND") return json({ detail: "Country not found" }, 404);
    console.error("API request failed", error);
    return json({ detail: "Data service unavailable" }, 503);
  }
}

function compactSnapshot(country: any) {
  return { ...country, metrics: Object.fromEntries(Object.entries(country.metrics).map(([id, metric]: [string, any]) =>
    [id, { ...metric, history: [] }])) };
}

function apiPath(pathname: string): string {
  const marker = pathname.lastIndexOf("/api");
  if (marker >= 0) return pathname.slice(marker + 4) || "/";
  const functionMarker = pathname.indexOf("/.netlify/functions/api");
  return functionMarker >= 0 ? pathname.slice(functionMarker + "/.netlify/functions/api".length) || "/" : pathname;
}

function optionalNumber(url: URL, name: string, min: number, max: number): number | null {
  const raw = url.searchParams.get(name);
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) throw new RangeError(`${name} must be between ${min} and ${max}`);
  return value;
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { ...corsHeaders(), "cache-control": "no-store" } });
}

function corsHeaders() {
  return { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type" };
}
