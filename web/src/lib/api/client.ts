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
 * Attaches the current session's access token. Call this once you have a token (e.g. after
 * POST /auth/login) — every subsequent request through `api` will carry it.
 */
export function setAccessToken(token: string | null) {
  api.use({
    onRequest({ request }) {
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
  });
}

/**
 * Attaches X-Reauth-Token for one step-up call (POST /payments/approve,
 * POST /reimbursements/:id/status, POST /staff/me/signature — see docs/backend/04-authorization.md §9).
 * Get `reauthToken` from POST /auth/verify-password first.
 */
export function withReauth(reauthToken: string) {
  return { headers: { "X-Reauth-Token": reauthToken } };
}
