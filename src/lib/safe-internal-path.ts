/**
 * Returns a same-origin relative path safe to use after login, or null if untrusted.
 * Rejects protocol-relative URLs, absolute URLs, and backslashes.
 */
export function safeInternalPath(raw: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.includes("\\")) return null;
  return trimmed;
}
