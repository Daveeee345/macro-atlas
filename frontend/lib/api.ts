import type {
  CompareResponse,
  CountrySnapshot,
  PolicyPoint,
  RegimePoint,
  SystemStatus,
} from "./types";

// Netlify rewrites same-origin /api requests to the serverless API function.
// The override remains useful when comparing against the reference FastAPI app locally.
const API = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/$/, "");
const qs = (period?: string | null) =>
  period ? `?period=${encodeURIComponent(period)}` : "";

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`API ${response.status}: ${path}`);
  return response.json();
}

export const api = {
  universe: (period?: string | null) =>
    get<CountrySnapshot[]>(`/api/universe${qs(period)}`),
  countries: (period?: string | null) =>
    get<CountrySnapshot[]>(`/api/countries${qs(period)}`),
  country: (code: string, period?: string | null) =>
    get<CountrySnapshot>(`/api/countries/${code}${qs(period)}`),
  regimes: (period?: string | null) =>
    get<RegimePoint[]>(`/api/regimes${qs(period)}`),
  policy: (period?: string | null) =>
    get<PolicyPoint[]>(`/api/policy${qs(period)}`),
  compare: (left = "IDN", right = "USA", period?: string | null) =>
    get<CompareResponse>(
      `/api/compare?left=${left}&right=${right}${period ? `&period=${encodeURIComponent(period)}` : ""}`,
    ),
  periods: () => get<string[]>("/api/periods"),
  status: () => get<SystemStatus>("/api/system/status"),
  lineage: (code: string, indicator: string) =>
    get<any>(`/api/lineage/${code}/${indicator}`),
};
