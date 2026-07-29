import { ImageResponse } from "next/og";
import { SITE } from "@/lib/seo";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#16150F";
const CANVAS = "#F7F6F3";
const COPPER = "#A8663C";

const R_BODY = "M14 10h13a7 7 0 0 1 0 14h-7v14h-6V10Zm6 5h7a2 2 0 0 1 0 4h-7v-4Z";
const R_LEG = "M27 24l9 14h-7.2L20 24Z";

/**
 * Pull the real wordmark face at build time. If the network is unavailable the
 * card still renders — just in the runtime's default sans — rather than failing
 * the build.
 */
async function loadFont(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@${weight}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    }).then((r) => r.text());
    const url = css.match(/src:\s*url\((https:\/\/[^)]+)\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [semibold, regular] = await Promise.all([loadFont(600), loadFont(400)]);

  const fonts = [
    semibold && { name: "Instrument Sans", data: semibold, weight: 600 as const, style: "normal" as const },
    regular && { name: "Instrument Sans", data: regular, weight: 400 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" }[];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: CANVAS,
        padding: "72px 80px",
        fontFamily: fonts.length ? "Instrument Sans" : "sans-serif",
        position: "relative",
      }}
    >
      {/* copper wash, bottom-left */}
      <div
        style={{
          position: "absolute",
          left: -160,
          bottom: -220,
          width: 760,
          height: 620,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(176,141,87,0.30), rgba(176,141,87,0) 68%)",
        }}
      />

      {/* lockup */}
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <svg width="72" height="72" viewBox="0 0 48 48">
          <rect width="48" height="48" rx="11" fill={INK} />
          <path d={R_BODY} fill={CANVAS} fillRule="evenodd" />
          <path d={R_LEG} fill={COPPER} />
        </svg>
        <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.5, color: INK }}>Realcorp</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <div
          style={{
            fontSize: 82,
            fontWeight: 600,
            letterSpacing: -3.4,
            lineHeight: 1.03,
            color: INK,
            maxWidth: 960,
          }}
        >
          Everything a real corporation runs on.
        </div>
        <div style={{ fontSize: 30, color: "#56524A", letterSpacing: -0.6, maxWidth: 900 }}>
          Sales, inventory, finance and people on one ledger.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22,
          fontSize: 21,
          color: "#8B857B",
          letterSpacing: 1.6,
          textTransform: "uppercase",
        }}
      >
        <span style={{ width: 44, height: 2, background: COPPER }} />
        <span>Property-first ERP</span>
        <span>·</span>
        <span>Lagos · New York · Dubai</span>
      </div>
    </div>,
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
