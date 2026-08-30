"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormAlert } from "@/components/form-message";
import { ButtonSpinner } from "@/components/button-spinner";
import { useSnackbar } from "@/components/snackbar";
import { MarketingLeadRouting } from "@/generated/prisma";
import { saveMarketingLeadRouting } from "../actions";

export function MarketingSettingsWorkspace({
  tenantSlug,
  routing,
  pendingCount,
  canEdit,
}: {
  tenantSlug: string;
  routing: MarketingLeadRouting;
  pendingCount: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [state, action, pending] = useActionState(
    saveMarketingLeadRouting.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      showSnackbar("Marketing funnel setting saved.", "success");
      router.refresh();
    }
  }, [state, router, showSnackbar]);

  return (
    <div className="w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Marketing</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">Marketing settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Choose how form fills, Facebook, Instagram, and other marketing inbound reach Sales. Each
        organization can pick the funnel it prefers.
      </p>

      <section className="mt-8 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Lead funnel</h2>
        <p className="mt-1 text-xs text-muted">
          Manual leads created on Sales → Leads always stay in Sales. This only changes marketing
          inbound.
        </p>

        {state && !state.ok ? (
          <div className="mt-3">
            <FormAlert>{state.error}</FormAlert>
          </div>
        ) : null}

        <form action={action} className="mt-4 space-y-3">
          <label className="flex items-start gap-3 rounded-lg border border-foreground/10 bg-field px-3 py-3 text-sm">
            <input
              type="radio"
              name="marketingLeadRouting"
              value={MarketingLeadRouting.SALES_IMMEDIATE}
              defaultChecked={routing === MarketingLeadRouting.SALES_IMMEDIATE}
              disabled={!canEdit}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-foreground">Send to Sales Leads immediately</span>
              <span className="mt-0.5 block text-xs text-muted">
                Default. Sales can monitor every new form or ad lead as it comes in.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-foreground/10 bg-field px-3 py-3 text-sm">
            <input
              type="radio"
              name="marketingLeadRouting"
              value={MarketingLeadRouting.MARKETING_HOLD}
              defaultChecked={routing === MarketingLeadRouting.MARKETING_HOLD}
              disabled={!canEdit}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-foreground">Hold in Marketing Entries first</span>
              <span className="mt-0.5 block text-xs text-muted">
                Marketing reviews the entry, assigns someone, then pushes it to Sales Leads.
              </span>
            </span>
          </label>

          {canEdit ? (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {pending ? <ButtonSpinner /> : null}
              {pending ? "Saving…" : "Save funnel"}
            </button>
          ) : (
            <p className="text-xs text-muted">Only an organization admin or marketing lead can change this.</p>
          )}
        </form>

        {pendingCount > 0 ? (
          <p className="mt-4 text-xs text-muted">
            {pendingCount} {pendingCount === 1 ? "entry is" : "entries are"} waiting in{" "}
            <Link href={`/${tenantSlug}/marketing/entries`} className="font-semibold underline">
              Marketing → Entries
            </Link>
            . Changing this setting does not move them automatically.
          </p>
        ) : null}
      </section>
    </div>
  );
}
