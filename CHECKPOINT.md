# Checkpoint — where we are, and how to get back

Written 2026-07-29. Update this when a layer lands.

---

## ⚠️ Do these before you leave

```bash
rm -f .git/index.lock          # stale lock I created and can't delete from the sandbox
npm run build                  # THE gate — I could not run it, see below
npm run dev                    # then click through the tenant app yourself
```

**I could not run a production build.** Every attempt hit `EPERM: operation not permitted, unlink`
on the FUSE mount — Next has to clear its output directory and the sandbox blocks deletes. `tsc
--noEmit` is clean and the dev server serves `/`, `/login`, `/llms.txt` and `/sitemap.xml` at 200,
but that is not the same guarantee. Run `npm run build` before you drive.

**I also could not open any tenant page** — no database in the sandbox. Everything under
`/[tenantSlug]/**` is verified by type-checking and lint only. Click through Dashboard, Projects,
Public listings, Expenses and Explore yourself, in both light and dark mode.

`next.config.ts` gained `distDir: process.env.NEXT_DIST_DIR || ".next"` so a build can target a
scratch directory. Default behaviour is unchanged; delete the line if you don't want it.

## First: clear the stale git lock

I created a `.git/index.lock` from a sandbox that can't delete it. Nothing is corrupted, but git
writes will fail until you run:

```bash
rm -f .git/index.lock
```

Then take your own checkpoint before anything else:

```bash
git add -A
git commit -m "Checkpoint: landing v2 live, brand B, SEO layer"
git tag checkpoint-landing-v2
```

## Safe points

| Marker | What it is |
|---|---|
| `9083b21` | Last commit before any of my work — *"Invesotor Portal upgrade and Beccas Dueluxe Listing"* |
| tag `pre-ui-polish` | Same commit, tagged for convenience |

Everything after that is uncommitted working-tree changes. `git diff` shows the lot.

## Layers, newest last

Each layer is independently reversible. Nothing was deleted — every file the old code needed is
still on disk.

### 1 · Landing page v2

New files, no edits to old ones:

```
src/components/marketing/v2/     landing-v2.tsx, marks.tsx, icons.tsx, fonts.ts, landing-seo.tsx
src/styles/landing-v2.css
src/app/preview/landing/page.tsx
landing-v2-preview/              index.html, brand.html, logos.html, README.md
```

Changed: `src/app/page.tsx` (points at `LandingV2`).

**Revert:** change the import in `src/app/page.tsx` back to
`@/components/marketing/landing-page`. The old `landing-page.tsx` and `landing.css` are untouched.

### 2 · Brand mark B

New: `public/brand/**`, `public/favicon.ico`, `public/apple-touch-icon.png`, `public/icon-*.png`.

Changed: `src/components/realcorp-brand.tsx` (the `MARK` constant), `src/app/layout.tsx` (icons).

**Revert:** set `MARK` back to `/mark-dark.svg` and `/mark-light.svg`. Both still exist.

### 3 · SEO + AI layer

New: `src/lib/seo.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/manifest.ts`,
`src/app/opengraph-image.tsx`, `src/app/llms.txt/route.ts`.

Changed: `src/app/layout.tsx` (metadataBase → realcoerp.com), `.env.example`.

**Revert:** delete the new route files. They are additive; nothing depends on them.

### 4 · App UI foundation

**`src/app/globals.css` rewritten** as a real token system: surfaces, text, lines, copper accent,
semantic status colours (success/warn/danger/info), elevation, radii — plus shared component
classes (`.rc-card`, `.rc-btn`, `.rc-table`, `.rc-pill`, `.rc-metric-*`, `.rc-empty`,
`.rc-progress`). Old token names (`--error`, `--error-bg`, `--error-border`) are kept as aliases so
`FormAlert` / `FormFieldError` keep working.

**Theme toggle moved into the header.** It was `position: fixed` at `right-3 top-3` and was sitting
on top of "Sign out" on every app page — that is what clipped it. Now inline in
`TenantHeaderActions` and `PlatformHeaderActions`; `providers.tsx` only floats it on pages that have
no header of their own (login, join, explore, portals).

**Colour sweep — 771 replacements across 67 files.** Every hard-coded Tailwind palette class
(`bg-violet-500/10`, `text-indigo-700`, `border-emerald-200` …) mapped to a semantic token:

| Was | Now |
|---|---|
| violet, purple, fuchsia | `--accent` (copper) |
| indigo, sky, cyan, blue | `--info` |
| emerald, green, teal, lime | `--success` |
| amber, orange, yellow | `--warn` |
| red, rose | `--danger` |

`dark:` variants were dropped where they became redundant — the tokens flip themselves.

**⚠️ The whole of `src/` was reformatted by Prettier.** My sweep script had an over-broad
whitespace rule that collapsed indentation in the 67 files it touched. I fixed it by running
`npx prettier --write --print-width 110` over `src/`, which restored indentation but also
reformatted files I never intended to touch. Behaviour is unchanged and `tsc` passes clean, but
**the diff against `9083b21` is now much larger than the semantic change**. If you want a smaller
diff, revert and re-apply — the colour mapping table above is all you need to redo it.

Prettier was installed with `--no-save`, so it is not in `package.json`. Consider adding it and a
`.prettierrc` so formatting stops being a moving target.

**Revert:** `git checkout -- src/` once you have the checkpoint commit above.

### 5 · AI layer assessment

New: `docs/AI-LAYER.md`. Assessment only — no code. Short version: don't train a model, do
retrieval + tool-calling; the schema is in good shape; four gaps, of which standardising
`AuditLog.metadata` is the cheap-now-expensive-later one.

## Dependency added

`motion` (Framer Motion v12) — used only by the landing page.

## Before deploying

Set `NEXT_PUBLIC_APP_URL="https://realcoerp.com"` in production. Canonical URLs, sitemap, Open
Graph, JSON-LD `@id`s and `/llms.txt` all derive from it.

## Known open items

- Landing page: customer logos are placeholder glyphs; the stats (38 hrs, $2.1B, 99.4%, 40+) and
  the Hannah Reyes quote carried over from the old page and are now in JSON-LD, which makes them
  a claim rather than decoration. `SITE.sameAs` guesses the social handles.
- `lockup-*.png` in `public/brand/png/` were rasterised without Instrument Sans available — use
  the download buttons in `landing-v2-preview/brand.html` for anything public.
- Hero backdrop is still the placeholder drift, pending the motion-site prompt.
