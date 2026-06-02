import { cleanErrorMetadata, capturePlatformErrorEvent, guessTenantSlugFromPath } from "@/lib/platform-error-capture";

/** Server-side error capture — runs when RSC / route handlers throw (reliable digest logging). */
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
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (request.path.startsWith("/api/platform/error-reports")) return;

  const digest = typeof error.digest === "string" ? error.digest : null;
  if (!digest) return;

  try {
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
  } catch (reportErr) {
    console.error("[platform-error-capture] onRequestError failed", reportErr);
  }
}
