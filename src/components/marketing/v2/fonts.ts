import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";

/**
 * Self-hosted through next/font: no request to fonts.googleapis.com, no
 * render-blocking @import, no layout shift when the face swaps in. That is
 * worth real LCP and CLS points, which is worth real ranking.
 */

export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-rc-sans",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
  adjustFontFallback: true,
});

export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-rc-serif",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
  adjustFontFallback: true,
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-rc-mono",
  display: "swap",
  fallback: ["ui-monospace", "Menlo", "monospace"],
});

export const fontVariables = [instrumentSans.variable, instrumentSerif.variable, jetbrainsMono.variable].join(
  " ",
);
