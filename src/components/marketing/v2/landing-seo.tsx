import type { Metadata } from "next";
import { KEYWORDS, SITE, landingJsonLd } from "@/lib/seo";

/**
 * Metadata for the landing page. Imported by both `/` and the preview route so
 * the two never drift.
 */
export const landingMetadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    absolute: `Realcorp — ${SITE.tagline} | ERP for real estate & project-based corporations`,
  },
  description: SITE.description,
  keywords: [...KEYWORDS],
  applicationName: SITE.name,
  category: "Business Software",
  alternates: { canonical: "/" },
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE.url,
    siteName: SITE.name,
    locale: "en_US",
    title: `Realcorp — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `Realcorp — ${SITE.tagline}`,
    description: SITE.shortDescription,
  },
  other: {
    "theme-color": "#F7F6F3",
  },
};

/**
 * Organization + WebSite + SoftwareApplication + FAQPage as one script block.
 * Rendered server-side so crawlers that do not execute JavaScript still see it.
 */
export function LandingJsonLd() {
  return (
    <script
      type="application/ld+json"
      // Content is built from our own constants, never user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(landingJsonLd()) }}
    />
  );
}
