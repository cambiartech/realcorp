import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/safe-internal-path";

function pathFromHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (raw.startsWith("/")) return safeInternalPath(raw.split("#")[0] || raw);
  try {
    const url = new URL(raw);
    return safeInternalPath(`${url.pathname}${url.search}`);
  } catch {
    return null;
  }
}

export async function requestedLoginPath(fallbackPath: string) {
  const headerList = await headers();
  return (
    pathFromHeaderValue(headerList.get("x-pathname")) ||
    pathFromHeaderValue(headerList.get("next-url")) ||
    pathFromHeaderValue(headerList.get("x-url")) ||
    pathFromHeaderValue(headerList.get("x-invoke-path")) ||
    fallbackPath
  );
}

export async function redirectToLogin(fallbackPath: string): Promise<never> {
  const path = await requestedLoginPath(fallbackPath);
  redirect(`/login?callbackUrl=${encodeURIComponent(path)}`);
}
