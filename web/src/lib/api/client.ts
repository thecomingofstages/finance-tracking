import createClient from "openapi-fetch";
import type { paths } from "./types.gen";

/**
 * Typed API client for finance-tracking-api. `paths` is generated from api/swagger.yaml —
 * regenerate with `npm run gen:client` (in api/) after any route change, don't hand-edit
 * types.gen.ts. See api/README.md.
 *
 * Points at the local mock server by default (api/ runs with MOCK_MODE=true out of the box —
 * no database needed), so this works against real request/response shapes from day one.
 */
export const api = createClient<paths>({
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/v1",
});

/**
 * Attaches the current session's access token to every request through `api`. Safe to call
 * repeatedly — e.g. after login, and again after each refresh — it replaces the previous
 * middleware rather than stacking a new one on top (openapi-fetch's `.use()` accumulates
 * middleware indefinitely; without the eject() below, calling this twice would leave two
 * Authorization-setting middlewares registered instead of one).
 */
let authMiddleware: Parameters<typeof api.use>[0] | null = null;
export function setAccessToken(token: string | null) {
  if (authMiddleware) api.eject(authMiddleware);
  authMiddleware = {
    onRequest({ request }) {
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
  };
  api.use(authMiddleware);
}

/**
 * Attaches X-Reauth-Token for one step-up call (POST /payments/approve,
 * POST /reimbursements/:id/status, POST /staff/me/signature — see docs/backend/04-authorization.md §9).
 * Get `reauthToken` from POST /auth/verify-password first.
 */
export function withReauth(reauthToken: string) {
  return { headers: { "X-Reauth-Token": reauthToken } };
}
