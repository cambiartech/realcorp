import type { Metadata } from "next";
import { LandingV2 } from "@/components/marketing/v2/landing-v2";
import { landingMetadata } from "@/components/marketing/v2/landing-seo";

export const metadata: Metadata = landingMetadata;

/**
 * The previous landing page is still on disk at
 * `@/components/marketing/landing-page` (with `@/styles/landing.css`) if we
 * ever need to roll back — swap the import below and nothing else changes.
 */
export default function Home() {
  return <LandingV2 />;
}
