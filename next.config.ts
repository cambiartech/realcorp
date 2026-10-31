import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "22mb",
    },
  },
  /**
   * Lets a build target a scratch directory instead of `.next`, e.g.
   * `NEXT_DIST_DIR=.next-verify npm run build`. Useful for verifying a build
   * without touching the one the dev server is using. Defaults to `.next`, so
   * normal builds and deploys are unaffected.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keep Node-only DB drivers out of webpack bundles (instrumentation → platform-error-capture → db → pg).
  serverExternalPackages: ["pg", "@prisma/adapter-pg", "pg-connection-string", "pgpass", "pg-pool"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        path: false,
        stream: false,
        net: false,
        tls: false,
        dns: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
