/** Server-side error capture — never top-level Prisma/pg imports (breaks webpack / Edge). */
import {
  formatSerializedError,
  isSanitizedProductionErrorMessage,
  serializeError,
} from "@/lib/platform-error-details";

function guessTenantSlugFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const first = pathname.split("/").filter(Boolean)[0] || null;
  if (!first) return null;
  const reserved = new Set(["api", "platform", "login", "join", "auth", "f", "privacy", "terms"]);
  return reserved.has(first) ? null : first;
}

function cleanErrorMetadata(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object") return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Load the DB-backed capture helper at runtime only.
 * webpackIgnore keeps `pg` out of the instrumentation graph (Next webpack build).
 */
async function loadErrorCapture() {
  return import(/* webpackIgnore: true */ "./lib/platform-error-capture");
}

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

  console.error("[onRequestError]", {
    digest,
    path: request.path,
    method: request.method,
    runtime: process.env.NEXT_RUNTIME ?? "nodejs",
    ...context,
    error: serialized,
  });

  if (!digest) return;
  // Prisma/pg are Node-only.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { capturePlatformErrorEvent } = await loadErrorCapture();

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
      }) as never,
    });
  } catch (captureErr) {
    console.error("[onRequestError] failed to persist error event:", captureErr);
    console.error("[onRequestError] original error dump:\n", formatted);
  }
}
