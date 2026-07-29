import type { Metadata } from "next";
import { LandingV2 } from "@/components/marketing/v2/landing-v2";
import { landingMetadata } from "@/components/marketing/v2/landing-seo";

/** Preview only — noindex. The real metadata lives on `/`. */
export const metadata: Metadata = {
  ...landingMetadata,
  robots: { index: false, follow: false },
  alternates: undefined,
};

/**
 * Preview route for the landing redesign — the live page at `/` is untouched.
 * To ship: point src/app/page.tsx at <LandingV2 /> instead of <LandingPage />.
 */
export default function LandingPreview() {
  return <LandingV2 />;
}
