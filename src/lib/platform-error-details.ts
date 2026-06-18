/** Next.js replaces real server errors with this text in production client boundaries. */
const SANITIZED_PATTERNS = [
  /specific message is omitted in production builds/i,
  /An error occurred in the Server Components render/i,
  /Server Components render/i,
];

export function isSanitizedProductionErrorMessage(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  return SANITIZED_PATTERNS.some((p) => p.test(message));
}

export type SerializedError = {
  name: string;
  message: string;
  stack: string | null;
  cause: SerializedError | null;
};

export function serializeError(error: unknown, depth = 0): SerializedError {
  if (depth > 4) {
    return { name: "Error", message: "[cause depth limit]", stack: null, cause: null };
  }
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "",
      stack: typeof error.stack === "string" ? error.stack : null,
      cause: error.cause ? serializeError(error.cause, depth + 1) : null,
    };
  }
  return {
    name: "Error",
    message: typeof error === "string" ? error : JSON.stringify(error),
    stack: null,
    cause: null,
  };
}

export function formatSerializedError(err: SerializedError): string {
  const lines = [`${err.name}: ${err.message}`];
  if (err.stack) lines.push(err.stack);
  if (err.cause) {
    lines.push("Caused by:");
    lines.push(formatSerializedError(err.cause));
  }
  return lines.join("\n");
}

export function errorDetailScore(event: {
  message: string | null;
  stack: string | null;
  metadata?: unknown;
}): number {
  let score = 0;
  const meta = event.metadata as { source?: string } | null | undefined;
  if (meta?.source === "onRequestError") score += 100;
  if (event.stack && !isSanitizedProductionErrorMessage(event.stack)) score += 50;
  if (event.message && !isSanitizedProductionErrorMessage(event.message)) score += 40;
  if (meta?.source === "global-error-boundary" || meta?.source === "tenant-error-boundary") score -= 20;
  return score;
}

export function pickBestErrorEvent<T extends { message: string | null; stack: string | null; metadata?: unknown }>(
  events: T[],
): T | null {
  if (events.length === 0) return null;
  return [...events].sort((a, b) => errorDetailScore(b) - errorDetailScore(a))[0] ?? null;
}
