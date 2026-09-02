/**
 * Minimal HTTP client for the deployed-stack E2E suite.
 *
 * Deliberately NOT supertest: these tests run against a real origin (Railway) over the public
 * internet, so what is under test includes TLS, CORS, cookie attributes and proxy behaviour —
 * none of which supertest's in-process app sees. Node 22's global fetch is enough.
 */

const BASE = (process.env.E2E_API_URL || "https://finance-tracking-production-83ff.up.railway.app").replace(/\/$/, "");
const WEB_ORIGIN = (process.env.E2E_WEB_URL || "https://finance-tracking-web.thecomingofstages.workers.dev").replace(/\/$/, "");

/** Every request carries the real browser Origin so CORS is exercised on each call, not just
 *  in the one preflight test. */
async function call(method, path, { token, reauth, body, headers = {}, raw = false, cookie } = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path.startsWith("/v1") ? "" : "/v1"}${path}`;
  const h = { Origin: WEB_ORIGIN, ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (reauth) h["X-Reauth-Token"] = reauth;
  if (cookie) h.Cookie = cookie;

  let payload;
  if (body instanceof FormData) {
    payload = body; // let fetch set the multipart boundary
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    h["Content-Type"] = "application/json";
  }

  const res = await fetch(url, { method, headers: h, body: payload, redirect: "manual" });
  const out = {
    status: res.status,
    headers: res.headers,
    setCookie: res.headers.getSetCookie ? res.headers.getSetCookie() : [],
  };
  if (raw) {
    out.buffer = Buffer.from(await res.arrayBuffer());
    return out;
  }
  const text = await res.text();
  out.text = text;
  try {
    out.body = JSON.parse(text);
  } catch {
    out.body = null;
  }
  out.data = out.body?.data;
  out.code = out.body?.error?.code;
  return out;
}

const api = {
  base: BASE,
  webOrigin: WEB_ORIGIN,
  get: (p, o) => call("GET", p, o),
  post: (p, o) => call("POST", p, o),
  patch: (p, o) => call("PATCH", p, o),
  del: (p, o) => call("DELETE", p, o),
  options: (p, o) => call("OPTIONS", p, o),
};

module.exports = { api, BASE, WEB_ORIGIN };
