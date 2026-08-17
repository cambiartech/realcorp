"use client";

"use client";

import { prefillEmployeeFromUploadedDocs } from "@/app/[tenantSlug]/hr/document-intake-actions";

const CLIENT_TIMEOUT_MS = 28_000;

export const PREFILL_TIMEOUT_MESSAGE =
  "Prefill is taking too long. Reload this page — the fields may already be filled.";

type PrefillOk = {
  ok: true;
  applied: number;
  skipped: number;
  failed: Array<{ fileName: string; error: string }>;
  filled: string[];
  partial?: boolean;
};

type PrefillResult = PrefillOk | { ok: false; error: string };

export function prefillSuccessMessage(result: PrefillOk) {
  const failedHint = result.failed.length
    ? ` ${result.failed.length} file${result.failed.length === 1 ? "" : "s"} could not be read.`
    : "";
  const partialHint = result.partial
    ? " Some files were skipped to stay within the time limit — click Prefill with AI again for the rest."
    : "";
  return `Filled ${result.filled.join(", ") || "employee fields"} from ${result.applied} document${
    result.applied === 1 ? "" : "s"
  }.${failedHint}${partialHint}`;
}

async function withClientTimeout<T>(promise: Promise<T>, ms = CLIENT_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("PREFILL_TIMEOUT")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runPrefillFromUploadedDocs(tenantSlug: string, userId: string): Promise<PrefillResult> {
  try {
    return await withClientTimeout(prefillEmployeeFromUploadedDocs(tenantSlug, userId));
  } catch (error) {
    if (error instanceof Error && error.message === "PREFILL_TIMEOUT") {
      return { ok: false, error: PREFILL_TIMEOUT_MESSAGE };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Prefill failed. Reload and try again.",
    };
  }
}

export function notifyPrefillResult(
  showSnackbar: (message: string, tone?: "success" | "error" | "info") => void,
  result: PrefillResult,
): boolean {
  if (!result.ok) {
    showSnackbar(result.error, "error");
    return false;
  }
  if (!result.applied) {
    showSnackbar(
      result.failed[0]?.error || "Uploaded files were found, but no employee fields could be read.",
      "error",
    );
    return false;
  }
  showSnackbar(prefillSuccessMessage(result), "success");
  return true;
}
