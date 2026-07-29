import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Lets a build target a scratch directory instead of `.next`, e.g.
   * `NEXT_DIST_DIR=.next-verify npm run build`. Useful for verifying a build
   * without touching the one the dev server is using. Defaults to `.next`, so
   * normal builds and deploys are unaffected.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
