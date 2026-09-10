import type { Context } from "@netlify/functions";

export default async function syncScheduled(request: Request, _context: Context) {
  const token = process.env.MACRO_ATLAS_SYNC_TOKEN;
  if (!token) throw new Error("MACRO_ATLAS_SYNC_TOKEN is required");
  const endpoint = new URL("/.netlify/functions/sync-background", request.url);
  const response = await fetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" });
  if (!response.ok) throw new Error(`Background sync dispatch failed: ${response.status}`);
  return new Response(null, { status: 202 });
}
