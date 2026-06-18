/** Server-side error capture — use dynamic imports only, never top-level Prisma imports. */
import {
  formatSerializedError,
  isSanitizedProductionErrorMessage,
  serializeError,
} from "@/lib/platform-error-details";

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
  if (request.path.startsWith("/api/platform/error-reports")) return;

  const digest = typeof error.digest === "string" ? error.digest : null;
  const serialized = serializeError(error);
  const formatted = formatSerializedError(serialized);

  // Always log full details to runtime logs (Netlify → Functions / Runtime).
  console.error("[onRequestError]", {
    digest,
    path: request.path,
    method: request.method,
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    ...context,
    error: serialized,
  });

  if (!digest) return;

  // Prisma/pg do not run on Edge — skip DB capture but console above still fires.
  if (process.env.NEXT_RUNTIME === "edge") return;

  try {
    const { capturePlatformErrorEvent, cleanErrorMetadata, guessTenantSlugFromPath } =
      await import("@/lib/platform-error-capture");

    const message = isSanitizedProductionErrorMessage(serialized.message)
      ? serialized.cause?.message || serialized.message
      : serialized.message;

    const stack = serialized.stack || (serialized.cause ? formatSerializedError(serialized.cause) : null);

    await capturePlatformErrorEvent({
      digest,
      name: serialized.name,
      message: message || null,
      stack,
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
        serialized,
        formatted,
      }),
    });
  } catch (captureErr) {
    console.error("[onRequestError] failed to persist error event:", captureErr);
    console.error("[onRequestError] original error dump:\n", formatted);
  }
}
