import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Only the origin is sent cross-site, so portal tokens in URLs never leak via Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// When APP_URL is a tunnel (ngrok for PayPal webhooks), let the dev server serve its assets there.
function appHostname(): string[] {
  try {
    const { hostname } = new URL(process.env.APP_URL ?? "");
    return hostname && hostname !== "localhost" ? [hostname] : [];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: appHostname(),
  // Lets the E2E build use a separate output folder so it never clobbers a running dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"] },
    },
  },
  serverExternalPackages: ["@prisma/client"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/portal/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
