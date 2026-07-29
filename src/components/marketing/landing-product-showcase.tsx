"use client";

import { useState } from "react";

const SLIDES: Array<{ src: string; title: string; caption: string }> = [
  {
    src: "/screenshots/sc-1.png",
    title: "Command center",
    caption:
      "Role-based dashboards with finance analytics, pipeline intelligence, and inventory at a glance.",
  },
  {
    src: "/screenshots/sc-2.png",
    title: "Finance overview",
    caption: "Pending finance checks, approvals, and audit trail — sales and finance on one ledger.",
  },
  {
    src: "/screenshots/sc-3.png",
    title: "Banking & reconciliation",
    caption: "Import bank statements, auto-match transactions, and resolve exceptions in one queue.",
  },
  {
    src: "/screenshots/sc-4.png",
    title: "Reports",
    caption:
      "Profit, cash flow, and balance summaries with exportable views across projects and departments.",
  },
  {
    src: "/screenshots/sc-5.png",
    title: "Leads",
    caption: "Capture, score, and assign prospects — from WhatsApp and Meta through to conversion.",
  },
  {
    src: "/screenshots/sc-6.png",
    title: "Deals pipeline",
    caption: "Kanban board from lead to close, with unit allocation and finance handoff built in.",
  },
];

export function LandingProductShowcase() {
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const slide = SLIDES[index];
  const showPlaceholder = broken[slide.src] === true;

  function prev() {
    setIndex((i) => (i === 0 ? SLIDES.length - 1 : i - 1));
  }

  function next() {
    setIndex((i) => (i === SLIDES.length - 1 ? 0 : i + 1));
  }

  return (
    <section className="section product-showcase" id="screenshots" aria-label="Product screenshots">
      <div className="container">
        <div className="features-head">
          <div>
            <div className="eyebrow">§ Product</div>
            <h2 className="headline">See it in the workspace.</h2>
          </div>
          <p className="body">
            One ledger across sales, inventory, finance, and people — the same platform whether you run one
            market or many.
          </p>
        </div>

        <div className="showcase-frame">
          <div className="showcase-screen">
            {!showPlaceholder ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={slide.src}
                src={slide.src}
                alt={slide.title}
                className="showcase-img"
                onError={() => setBroken((prev) => ({ ...prev, [slide.src]: true }))}
              />
            ) : (
              <div className="showcase-placeholder">
                <span className="showcase-placeholder-mark">R</span>
                <p>Screenshot unavailable</p>
                <p className="showcase-placeholder-hint">{slide.src}</p>
              </div>
            )}
          </div>
          <div className="showcase-caption">
            <div>
              <p className="showcase-slide-title">{slide.title}</p>
              <p className="body">{slide.caption}</p>
            </div>
            <div className="showcase-controls">
              <button type="button" className="showcase-nav" onClick={prev} aria-label="Previous screenshot">
                ←
              </button>
              <div className="showcase-dots" role="tablist" aria-label="Screenshots">
                {SLIDES.map((s, i) => (
                  <button
                    key={s.src}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={s.title}
                    className={["showcase-dot", i === index ? "active" : ""].filter(Boolean).join(" ")}
                    onClick={() => setIndex(i)}
                  />
                ))}
              </div>
              <button type="button" className="showcase-nav" onClick={next} aria-label="Next screenshot">
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
