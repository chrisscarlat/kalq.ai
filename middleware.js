// The gate: Q-Site's middleware with this site's config
import siteConfig from "./site.config.json" with { type: "json" };
import { createMiddleware } from "q-site/middleware.js";

export default createMiddleware(siteConfig);

// Node.js, not the deprecated edge runtime: Vercel's edge bundler rejects the JSON import above ("with")
export const config = { runtime: "nodejs" };
