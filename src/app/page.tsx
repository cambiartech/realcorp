import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/landing-page";

export const metadata: Metadata = {
  title: "Realcorp · ERP for real corporations",
  description:
    "Realcorp is the operating system for real corporations. Sales, inventory, finance, and people on one connected platform — property-first, built for how real businesses run.",
  openGraph: {
    title: "Realcorp · ERP for real corporations",
    description:
      "Sales, inventory, finance, and people connected on a single ledger of record. Built for real corporations worldwide — property-first, built to scale.",
    url: "https://realcorp.com/",
    siteName: "Realcorp",
  },
};

export default function Home() {
  return <LandingPage />;
}
