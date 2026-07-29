"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { LandingProductShowcase } from "@/components/marketing/landing-product-showcase";
import { LandingLockup, LandingMark, type LandingSurface } from "@/components/marketing/landing-mark";
import "@/styles/landing.css";

function pageSurface(resolvedTheme: string | undefined): LandingSurface {
  return resolvedTheme === "dark" ? "dark" : "light";
}

export function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const theme = mounted && resolvedTheme === "dark" ? "dark" : "light";
  const surface = pageSurface(theme);

  useEffect(() => {
    const nav = document.getElementById("landing-nav");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  const closeMobileNav = () => setMobileNavOpen(false);

  const mobileNavLinks = [
    { href: "#product", label: "Product" },
    { href: "#modules", label: "Modules" },
    { href: "#how", label: "How it works" },
    { href: "#demo", label: "Pricing" },
    { href: "/login", label: "Sign in", isRoute: true as const },
  ];

  return (
    <div className="landing-root min-h-dvh" data-theme={theme}>
      <header className="nav" id="landing-nav">
        <div className="container nav-inner">
          <LandingLockup surface={surface} />
          <nav className="nav-links" aria-label="Primary">
            <a href="#product">Product</a>
            <a href="#modules">Modules</a>
            <a href="#how">How it works</a>
            <a href="#demo">Pricing</a>
            <Link href="/login">Sign in</Link>
          </nav>
          <div className="nav-cta">
            <button
              type="button"
              className="nav-toggle"
              onClick={toggleTheme}
              aria-label="Toggle colour theme"
              title="Toggle theme"
            >
              {theme === "dark" ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              )}
            </button>
            <a className="btn btn-primary" href="#demo">
              Book a demo <span className="arrow">→</span>
            </a>
            <button
              type="button"
              className="nav-menu-btn"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              {mobileNavOpen ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18M3 12h18M3 18h18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div
          className={["nav-mobile-panel", mobileNavOpen ? "open" : ""].filter(Boolean).join(" ")}
          aria-hidden={!mobileNavOpen}
        >
          <nav className="nav-mobile-links" aria-label="Mobile">
            {mobileNavLinks.map((item) =>
              "isRoute" in item && item.isRoute ? (
                <Link key={item.href} href={item.href} onClick={closeMobileNav}>
                  {item.label}
                </Link>
              ) : (
                <a key={item.href} href={item.href} onClick={closeMobileNav}>
                  {item.label}
                </a>
              ),
            )}
            <a className="btn btn-primary nav-mobile-cta" href="#demo" onClick={closeMobileNav}>
              Book a demo <span className="arrow">→</span>
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero" id="product">
          <div className="container">
            <div className="hero-grid">
              <div>
                <div className="eyebrow">ERP for real corporations</div>
                <h1 className="display">
                  The operating system for <em>real corporations.</em>
                </h1>
                <p className="lede">
                  Sales, inventory, finance, and people — connected on a single ledger of record. Built for
                  the way real corporations actually run, with deep roots in property and project-based
                  businesses.
                </p>
                <div className="hero-cta">
                  <a className="btn btn-primary" href="#demo">
                    Book a demo <span className="arrow">→</span>
                  </a>
                  <a className="btn btn-ghost" href="#how">
                    See how it works
                  </a>
                </div>
                <div className="hero-meta">
                  <span>
                    <strong>40+</strong> organizations
                  </span>
                  <span>
                    <strong>$2.1B</strong> in volume tracked
                  </span>
                  <span>
                    <strong>Property-first</strong> · Global
                  </span>
                </div>
              </div>
              <div className="hero-visual">
                <LandingMark surface={surface} size={340} className="mark" priority />
              </div>
            </div>
          </div>
        </section>

        <section className="trust" aria-label="Customers">
          <div className="container trust-inner">
            <div className="trust-label">
              Trusted by real corporations worldwide — property-first, built to scale
            </div>
            <div className="trust-logos">
              {["Kingsway Estates", "Marigold Group", "Lekki Heights", "Sterling Realty", "Adron Homes"].map(
                (name) => (
                  <span key={name} className="trust-logo">
                    <span className="dot" />
                    {name}
                  </span>
                ),
              )}
            </div>
          </div>
        </section>

        <section className="section" id="modules">
          <div className="container">
            <div className="features-head">
              <div>
                <div className="eyebrow">§ Modules</div>
                <h2 className="headline">Six modules. One ledger.</h2>
              </div>
              <p className="body">
                Every Realcorp module reads from and writes to the same ledger of record. The pipeline closes
                a deal; the payment plan posts to receivables; the audit trail keeps everyone honest. No
                exports. No reconciliation theatre.
              </p>
            </div>

            <div className="features-grid">
              <FeatureCard
                num="01 · CRM"
                title="Sales CRM"
                body="Capture every lead. Score them. Work the pipeline without leaving the platform."
                items={[
                  "WhatsApp & Meta lead capture",
                  "Lead scoring & assignment rules",
                  "Deals, stages, activity feed",
                  "Quote-to-contract handoff",
                ]}
                icon={<UsersIcon />}
              />
              <FeatureCard
                num="02 · Inventory"
                title="Projects & units"
                body="Every unit, every status, every locking action — tied to the deal that holds it."
                items={[
                  "Project & unit inventory",
                  "Allocation, locking, releases",
                  "Shortlets module",
                  "Floor-plan & price-list links",
                ]}
                icon={<BuildingIcon />}
              />
              <FeatureCard
                num="03 · Finance"
                title="Finance"
                body="Milestone plans, receivables, bank reconciliation, vendor bills — one source of truth."
                items={[
                  "Milestone payment plans",
                  "Receivables & payables",
                  "Bank reconciliation",
                  "Vendor bills · audit logs",
                ]}
                icon={<BanknoteIcon />}
              />
              <FeatureCard
                num="04 · People"
                title="People & HR"
                body="From offer letter to payslip — onboarding bundled with the right forms for every role."
                items={[
                  "Bundled onboarding forms",
                  "Offer letters · contracts",
                  "Payslips & deductions",
                  "Departments & reporting lines",
                ]}
                icon={<UserCheckIcon />}
              />
              <FeatureCard
                num="05 · Platform"
                title="Multi-tenant platform"
                body="Every organization gets an isolated workspace. Operators get a central console."
                items={[
                  "Isolated tenant workspaces",
                  "Platform console · onboarding",
                  "SSO · role-based access",
                  "Per-tenant branding",
                ]}
                icon={<LayersIcon />}
              />
              <FeatureCard
                num="06 · Marketing"
                title="Marketing"
                body="Campaigns, broadcasts, and attribution that close the loop with the CRM."
                items={[
                  "Email & WhatsApp broadcasts",
                  "Embedded lead-capture forms",
                  "Campaign attribution",
                  "Audience segmentation",
                ]}
                icon={<MegaphoneIcon />}
              />
            </div>
          </div>
        </section>

        <section className="section" id="how" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="features-head">
              <div>
                <div className="eyebrow">§ How it works</div>
                <h2 className="headline">Three steps to operational.</h2>
              </div>
              <p className="body">
                Onboarding in under a week. Your team keeps using WhatsApp and email the way they always have
                — Realcorp is the system that ties it all together behind the scenes.
              </p>
            </div>

            <div className="steps">
              <div className="step">
                <div className="num" aria-hidden="true" />
                <h3>Onboard your organization</h3>
                <p className="body">
                  Spin up an isolated workspace. We migrate your existing project list, deal history, and
                  chart of accounts. Your team signs in with SSO.
                </p>
              </div>
              <div className="step">
                <div className="num" aria-hidden="true" />
                <h3>Configure your projects</h3>
                <p className="body">
                  Define project units, payment milestones, commission structure, and departments. Bring your
                  floor plans and price lists.
                </p>
              </div>
              <div className="step">
                <div className="num" aria-hidden="true" />
                <h3>Run sales, finance, and HR</h3>
                <p className="body">
                  Capture leads from WhatsApp and Meta. Move them through the pipeline. Allocate units, post
                  milestones, issue payslips — all in one place.
                </p>
              </div>
            </div>
          </div>
        </section>

        <LandingProductShowcase />

        {/* Always midnight — light mark regardless of page theme */}
        <section className="split" aria-label="Customer testimonial">
          <div className="container">
            <div className="split-inner">
              <div>
                <LandingMark surface="dark" size={140} className="mark" />
                <div className="eyebrow" style={{ marginTop: 32 }}>
                  A note from operations
                </div>
              </div>
              <div>
                <h2>
                  &ldquo;From contract to <em>payslip,</em> the same number reaches every desk.&rdquo;
                </h2>
                <div className="quote-cite">Hannah Reyes · SVP Operations · Kingsway Estates</div>
                <div className="stat-row">
                  <div className="stat">
                    <div className="v">38 hrs</div>
                    <div className="k">Weekly time saved</div>
                  </div>
                  <div className="stat">
                    <div className="v">$2.1B</div>
                    <div className="k">In gross volume</div>
                  </div>
                  <div className="stat">
                    <div className="v">99.4%</div>
                    <div className="k">Audit-trail coverage</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-block" id="demo">
          <div className="container">
            <div className="eyebrow">Let&apos;s talk</div>
            <h2 className="headline" style={{ margin: 0, maxWidth: "22ch" }}>
              See Realcorp configured to{" "}
              <em style={{ fontStyle: "italic", color: "var(--accent)" }}>your projects.</em>
            </h2>
            <p className="lede" style={{ textAlign: "center" }}>
              A 30-minute call with a solutions engineer. We&apos;ll bring a workspace pre-loaded with your
              project list — so the demo isn&apos;t generic.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
              <a className="btn btn-primary" href="mailto:hello@realcorp.com">
                Book a demo <span className="arrow">→</span>
              </a>
              <Link className="btn btn-ghost" href="/login">
                Have an account? Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container">
          <div className="footer-grid">
            <div>
              <LandingLockup surface={surface} markSize={32} />
              <p className="body" style={{ marginTop: 14, maxWidth: "38ch", fontSize: "13.5px" }}>
                The operating system for real corporations. Global platform — offices in Lagos, New York, and
                Dubai.
              </p>
            </div>
            <FooterCol
              title="Product"
              links={[
                ["Modules", "#modules"],
                ["How it works", "#how"],
                ["Pricing", "#demo"],
                ["Changelog", "/changelog"],
              ]}
            />
            <FooterCol
              title="Company"
              links={[
                ["About", "/about"],
                ["Customers", "/customers"],
                ["Careers", "/careers"],
                ["Contact", "/contact"],
              ]}
            />
            <FooterCol
              title="Legal"
              links={[
                ["Privacy", "/privacy"],
                ["Terms", "/terms"],
                ["Security", "/security"],
                ["DPA", "/dpa"],
              ]}
            />
          </div>
          <div className="footer-bottom">
            <span>© 2026 Realcorp, Inc. · One Federal Square · Lagos · NY · DXB</span>
            <span>v01 · MMXXVI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  num,
  title,
  body,
  items,
  icon,
}: {
  num: string;
  title: string;
  body: string;
  items: string[];
  icon: React.ReactNode;
}) {
  return (
    <article className="feature">
      <div className="feature-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="num">{num}</div>
      <h3>{title}</h3>
      <p className="body">{body}</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div className="footer-col">
      <h4>{title}</h4>
      <ul>
        {links.map(([label, href]) => (
          <li key={label}>
            {href.startsWith("#") || href.startsWith("/") ? (
              href.startsWith("#") ? (
                <a href={href}>{label}</a>
              ) : (
                <Link href={href}>{label}</Link>
              )
            ) : (
              <a href={href}>{label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function UsersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v8h4M18 9h2a2 2 0 0 1 2 2v11h-4M10 6h4M10 10h4M10 14h4M10 18h4" />
    </svg>
  );
}

function BanknoteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

function UserCheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 21a8 8 0 0 1 13.292-6" />
      <circle cx="10" cy="8" r="5" />
      <path d="m16 19 2 2 4-4" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </svg>
  );
}
