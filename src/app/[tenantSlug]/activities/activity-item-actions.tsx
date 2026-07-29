"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/snackbar";
import { ButtonSpinner } from "@/components/button-spinner";
import { completeActivity, deleteActivity, replyWhatsApp } from "./actions";

/** Mark done + delete controls for an activity row, with feedback and confirmation. */
export function ActivityRowActions({
  tenantSlug,
  activityId,
  showComplete,
}: {
  tenantSlug: string;
  activityId: string;
  showComplete: boolean;
}) {
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleComplete() {
    startTransition(async () => {
      const result = await completeActivity(tenantSlug, activityId);
      if (result.ok) {
        showSnackbar("Marked as done.", "success");
        router.refresh();
      } else {
        showSnackbar(result.error, "error");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteActivity(tenantSlug, activityId);
      if (result.ok) {
        showSnackbar("Activity deleted.", "success");
        router.refresh();
      } else {
        showSnackbar(result.error, "error");
      }
      setConfirming(false);
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-muted">Delete?</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-error/40 bg-[var(--error-bg)] px-2 py-1 font-semibold text-error disabled:opacity-60"
        >
          {pending ? <ButtonSpinner /> : null}
          Yes, delete
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-md border border-foreground/15 px-2 py-1 font-medium text-muted hover:text-foreground disabled:opacity-60"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {showComplete ? (
        <button
          type="button"
          onClick={handleComplete}
          disabled={pending}
          className="inline-flex items-center gap-1 text-[var(--success)] underline decoration-[var(--success-line)] underline-offset-2 disabled:opacity-60"
        >
          {pending ? <ButtonSpinner /> : null}
          Mark done
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={pending}
        className="text-error underline decoration-error/40 underline-offset-2 disabled:opacity-60"
      >
        Delete
      </button>
    </span>
  );
}

/** Inline WhatsApp reply box with pending state and feedback. */
export function WhatsAppReplyBox({
  tenantSlug,
  leadId,
  toPhone,
}: {
  tenantSlug: string;
  leadId: string;
  toPhone: string;
}) {
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSend() {
    const trimmed = message.trim();
    if (!trimmed) {
      showSnackbar("Type a reply first.", "error");
      return;
    }
    startTransition(async () => {
      const formData = new FormData();
      formData.set("message", trimmed);
      const result = await replyWhatsApp(tenantSlug, leadId, toPhone, formData);
      if (result.ok) {
        showSnackbar("WhatsApp reply sent.", "success");
        setMessage("");
        router.refresh();
      } else {
        showSnackbar(result.error, "error");
      }
    });
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSend();
          }
        }}
        disabled={pending}
        placeholder="Reply on WhatsApp..."
        className="w-64 rounded-md border border-foreground/15 bg-background px-2 py-1 text-xs text-foreground disabled:opacity-60"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--success-line)] bg-[var(--success-wash)] px-2 py-1 text-xs font-medium text-[var(--success)] disabled:opacity-60"
      >
        {pending ? <ButtonSpinner /> : null}
        {pending ? "Sending…" : "Send reply"}
      </button>
    </div>
  );
}
