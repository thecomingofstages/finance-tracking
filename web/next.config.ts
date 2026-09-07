import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev`.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
//
// Guarded on NODE_ENV: this hook is for `next dev` only. Called unconditionally it also runs
// under `next start`, which then resolves pages against `.next/dev/...` and dies with ENOENT —
// so `npm run start` could never serve a production build locally. The Cloudflare deploy is
// unaffected either way (it runs `opennextjs-cloudflare build`, never `next start`), which is
// why this went unnoticed.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
if (process.env.NODE_ENV === "development") {
	initOpenNextCloudflareForDev();
}
