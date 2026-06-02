/** Server-side error capture — use dynamic imports only, never top-level Prisma imports. */
export async function onRequestError(
  error: Error & { digest?: string },
  request: { path: string; method: string },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
    renderSource?: string;
  },
) {
  // Only run in Node.js runtime — Prisma/pg don't work in Edge
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (request.path.startsWith("/api/platform/error-reports")) return;

  const digest = typeof error.digest === "string" ? error.digest : null;
  if (!digest) return;

  try {
    // Dynamic import keeps Prisma out of the Edge bundle entirely
    const { capturePlatformErrorEvent, cleanErrorMetadata, guessTenantSlugFromPath } =
      await import("@/lib/platform-error-capture");

    await capturePlatformErrorEvent({
      digest,
      name: error.name || "Error",
      message: error.message || null,
      stack: typeof error.stack === "string" ? error.stack : null,
      routePath: request.path,
      requestUrl: request.path,
      tenantSlug: guessTenantSlugFromPath(request.path),
      metadata: cleanErrorMetadata({
        source: "onRequestError",
        method: request.method,
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
        renderSource: context.renderSource ?? null,
      }),
    });
  } catch {
    // best-effort — never crash the app over telemetry
  }
}
