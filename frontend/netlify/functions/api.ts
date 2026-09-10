import type { Context } from "@netlify/functions";
import { handleApi } from "./_shared/api-handler";

export default async function api(request: Request, _context: Context) {
  return handleApi(request);
}
