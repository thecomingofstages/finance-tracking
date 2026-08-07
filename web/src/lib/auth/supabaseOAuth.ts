/**
 * Supabase Auth is only an identity handshake in this app — it proves "this browser controls
 * this Google account, and its email is X". The session that actually authorizes API calls is
 * ours (RS256, issued by POST /auth/login/supabase or POST /auth/claim, see
 * api/src/app/helpers/Auth.helper.js). So we never keep a Supabase session around: we read its
 * access token once on the callback, trade it in, and drop it.
 *
 * That is why there is no @supabase/supabase-js client here. supabase-js would persist a second
 * session in localStorage that nothing reads and nothing invalidates on logout, and would need
 * NEXT_PUBLIC_SUPABASE_ANON_KEY on top of the URL. The redirect below needs neither.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";

/** Where Supabase sends the browser back to. Must be in the redirect allow-list —
 *  supabase/config.toml [auth] additional_redirect_urls locally, Authentication → URL
 *  Configuration in the dashboard for the hosted project. */
export const OAUTH_CALLBACK_PATH = "/auth/callback";

/** sessionStorage, not localStorage: the token is single-use and must not outlive the tab.
 *  Not a query param either — an access token in a URL lands in history and Referer headers. */
const PENDING_TOKEN_KEY = "tcos.supabase.pending_access_token";

export interface SupabaseHashSession {
  accessToken?: string;
  /** Populated when Supabase redirects back with a failure instead of a session. */
  error?: string;
}

/**
 * Sends the browser to Google via Supabase. `redirect_to` is resolved against the live origin,
 * so the same build works on localhost and on the deployed Worker without another env var.
 */
export function startGoogleLogin(): void {
  const redirectTo = `${window.location.origin}${OAUTH_CALLBACK_PATH}`;
  window.location.href =
    `${SUPABASE_URL}/auth/v1/authorize` +
    `?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
}

/**
 * Reads the implicit-flow session Supabase leaves in the URL fragment, then scrubs the fragment
 * from the address bar and from history so a back-navigation or a shared URL can't replay it.
 * Errors can arrive in either the fragment or the query string depending on where GoTrue failed.
 */
export function consumeSessionFromUrl(): SupabaseHashSession {
  if (typeof window === "undefined") return {};

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);

  const error =
    hash.get("error_description") ||
    hash.get("error") ||
    query.get("error_description") ||
    query.get("error") ||
    undefined;
  const accessToken = hash.get("access_token") || undefined;

  window.history.replaceState(null, "", window.location.pathname);

  return { accessToken, error: error ?? undefined };
}

/** Hand the Supabase token to the claim form on the next page without putting it in the URL. */
export function stashPendingToken(token: string): void {
  try {
    window.sessionStorage.setItem(PENDING_TOKEN_KEY, token);
  } catch {
    // Private mode / storage disabled — the claim form falls back to asking for the token.
  }
}

/** Non-destructive read — the claim form may mount more than once (StrictMode, a refresh after
 *  a validation error) and each mount still needs the token. Clearing is clearPendingToken()'s
 *  job, once the claim actually succeeds. */
export function peekPendingToken(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearPendingToken(): void {
  try {
    window.sessionStorage.removeItem(PENDING_TOKEN_KEY);
  } catch {
    // Nothing to clean up if storage was never writable.
  }
}
