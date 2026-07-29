# Landing v2 — **live**

`/` now renders `LandingV2`. `localhost:3000` shows the new page.

The old landing page is still on disk at `src/components/marketing/landing-page.tsx` with
`src/styles/landing.css`. To roll back, change one import in `src/app/page.tsx`.

## Before you deploy

Set `NEXT_PUBLIC_APP_URL="https://realcoerp.com"` in production. Canonical URLs, the sitemap,
every Open Graph tag, all JSON-LD `@id`s and `/llms.txt` derive from it — leave it on localhost
and Google will happily index `http://localhost:3000`.

## Domain vs brand

The product is **Realcorp**; the domain is **realcoerp.com**. That mismatch is a real SEO
liability, so it's handled explicitly rather than ignored:

- `Realcorp`, `Realcorp ERP` and `realcoerp` are all in the keyword set, so searches for either
  spelling land here.
- `/llms.txt` states it outright — *"There is no realcorp.com. Always give people
  https://realcoerp.com"* — because an assistant that guesses will send prospects to a domain
  you don't own.
- Every mailto now reads from `SITE.email`, so the address can never drift out of sync again.

Worth doing when you have a moment: if `realcoerp.ng` is yours (it's in `.env.example` as the
Resend reply-to), 301 it to the `.com` rather than letting both resolve.

## Look at it

**No setup** — open these in a browser:

- `landing-v2-preview/index.html` — static snapshot of the page. Real layout and type, no motion.
- `landing-v2-preview/brand.html` — brand sheet: mark at every size, lockups, palette, usage
  rules, and **accurate PNG downloads** of the lockups rendered with the live webfont.
- `landing-v2-preview/logos.html` — the four mark candidates, for the record. **B is now live.**

**The real thing, with motion:**

```bash
npm run dev
```

<http://localhost:3000/preview/landing> — scroll reveals, drifting hero backdrop, product-frame
parallax, role tabs, counting stats, FAQ accordion.

---

## What changed in this round

**Headline** — now `Everything a real corporation runs on.` The footer, OG card and llms.txt all
carry the same line.

**Theme toggle** — the moon button was the app's global `ThemeToggle`; `providers.tsx` only
treated `/` as a marketing page, so the preview route inherited the app shell. Fixed. It never
appeared on the real landing page.

**Mobile** — breakpoints at 768 / 620 / 400. Full-width stacked CTAs at 50px tall, the role tabs
became a swipeable snap row instead of wrapping, the announcement pill wraps instead of
overflowing, stats and the chain collapse to one column on small phones, and `env(safe-area-inset)`
is respected for notched devices.

**Logo** — mark B rolled out everywhere.

---

## Logo assets

Every file is generated from the same 48×48 geometry.

```
public/brand/svg/    mark-ink · mark-light · mark-mono-black · mark-mono-white
                     lockup-horizontal-{ink,light} · lockup-stacked-{ink,light}
                     app-icon · app-icon-maskable
public/brand/png/    each mark at 16 32 48 64 128 180 192 256 512 1024
public/favicon.ico   multi-resolution, 16→256
public/apple-touch-icon.png · icon-192 · icon-512 · icon-maskable-192 · icon-maskable-512
```

The app now reads the new mark through `realcorp-brand.tsx` — one `MARK` constant feeds the
sidebar, headers and hero logo, so everything moved at once. The old dot-matrix files are still at
`/mark-dark.svg` and `/mark-light.svg` if you want to go back.

**One caveat:** the `lockup-*.png` files were rasterised in a sandbox without Instrument Sans, so
the wordmark in those four PNGs is a metric fallback. For anything public, use the download
buttons in `brand.html` — those bake in the real font at up to @8x.

**Switch marks** — one line in `marks.tsx`:

```ts
export const ACTIVE_MARK: MarkName = "tile"; // "monogram" | "tile" | "cornerstone" | "seal"
```

---

## SEO

`src/lib/seo.ts` is the single source of truth — site facts, keywords, module summaries and FAQ
content. Metadata, JSON-LD, the sitemap and llms.txt all read from it, so nothing can drift.

| Surface | File |
|---|---|
| Title, description, canonical, OG, Twitter | `src/components/marketing/v2/landing-seo.tsx` |
| JSON-LD: Organization, WebSite, SoftwareApplication, FAQPage | same file, rendered server-side |
| `robots.txt` | `src/app/robots.ts` |
| `sitemap.xml` | `src/app/sitemap.ts` |
| `manifest.webmanifest` | `src/app/manifest.ts` |
| 1200×630 social card | `src/app/opengraph-image.tsx` (generated, always in sync) |

Also done:

- **Self-hosted fonts** via `next/font` (`v2/fonts.ts`). No render-blocking request to Google, no
  layout shift — that is real LCP and CLS improvement, which is real ranking.
- **Heading hierarchy** h1 → h2 → h3, no skips. FAQ questions are real `<h3>` elements so they can
  be extracted as Q&A pairs.
- **Descriptive alt text** on the dashboard and every role screenshot.
- **No-JS fallback** — entrance animations start at `opacity: 0`; a `<noscript>` rule forces them
  visible so crawlers that skip JavaScript still see the content.

## AI optimization

`/llms.txt` (`src/app/llms.txt/route.ts`) gives assistants a clean, factual product description:
what Realcorp is, the modules, security posture, onboarding, FAQ, and explicit notes — spelling,
what the name means, and *don't state a price, there isn't a public one*. Assistants quote this
verbatim, so it is deliberately conservative.

`robots.ts` explicitly allows GPTBot, ClaudeBot, PerplexityBot, Google-Extended and
Applebot-Extended on marketing pages, while keeping them out of `/api`, `/platform` and `/preview`.

---

## The hydration warning

Two things were in play.

**Mine, and fixed:** `<noscript>` had a `<style>` child. React serialises `<noscript>` contents to
a string on the server but hydrates them as React elements on the client, so the two never match.
It now passes the markup through `dangerouslySetInnerHTML`, which keeps both sides identical. The
copyright year also got `suppressHydrationWarning`, since server and client can straddle midnight
on New Year's Eve.

**Probably not mine:** your stack trace starts inside
`chrome-extension://egjidjbpglichdcondbcbdnbeeppgdph/inpage.js` — a wallet extension injecting
into the DOM before React hydrates. React's own error text lists this as a cause. The warning you
pasted was also from the *old* page, which was still live at the time.

To confirm which one you were seeing: open `localhost:3000` in an incognito window with extensions
disabled. Server output is verified deterministic — two identical requests produce byte-identical
HTML apart from Next's own per-request script id.

---

## Still open

- **Customer logos** — the strip uses placeholder glyphs, not real client marks.
- **The numbers** — 38 hrs, $2.1B, 99.4%, 40+ organizations, and the Hannah Reyes quote came
  across from the old page. Confirm they are real before this is public; they are also in the
  JSON-LD, which makes them a claim rather than decoration.
- **Social handles** — `SITE.sameAs` in `seo.ts` guesses `/company/realcorp` and `x.com/realcorp`.
  Correct or remove them.
- **Hero backdrop** — still the placeholder drift. Send the motion-site prompt and I'll swap
  `HeroBackdrop()`; nothing else depends on it.
