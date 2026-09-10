import type { Config, Context } from "@netlify/functions";
import { syncOfficialData } from "./_shared/sync";

export default async function syncBackground(request: Request, _context: Context) {
  const token = process.env.MACRO_ATLAS_SYNC_TOKEN;
  if (!token || request.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const result = await syncOfficialData();
  return Response.json(result);
}

export const config: Config = { background: true };
