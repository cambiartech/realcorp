"use client";

import { useState, useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import {
  enablePellowsChannel,
  removeChannelCalendarImport,
  rotatePellowsChannelToken,
  revokePellowsChannel,
  saveChannelCalendarImport,
  syncChannelCalendarImport,
} from "@/app/[tenantSlug]/shortlets/channel-actions";

type Feed = { unitId: string; unitName: string; icalUrl: string };
type ImportRow = {
  id: string;
  unitName: string;
  providerLabel: string;
  icalUrl: string;
  lastSyncedLabel: string | null;
  lastError: string | null;
};

type Props = {
  tenantSlug: string;
  tenantId: string;
  pellowsStatus: "ACTIVE" | "REVOKED" | "OFF";
  tokenPrefix: string | null;
  lastUsedLabel: string | null;
  feeds: Feed[];
  imports: ImportRow[];
};

export function ChannelConnections({
  tenantSlug,
  tenantId,
  pellowsStatus,
  tokenPrefix,
  lastUsedLabel,
  feeds,
  imports,
}: Props) {
  const { showSnackbar } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [consent, setConsent] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [form, setForm] = useState({ unitId: feeds[0]?.unitId || "", provider: "AIRBNB", icalUrl: "" });

  function run(fn: () => Promise<{ ok: boolean; error?: string; token?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        showSnackbar(result.error || "Could not save.", "error");
        return;
      }
      if (result.token) setRevealedToken(result.token);
      showSnackbar(success, "success");
    });
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showSnackbar("Copied.", "success");
    } catch {
      showSnackbar("Select the value and copy it.", "error");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-foreground/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Pellows</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Guests can find these apartments on Pellows. Pellows reads the unit, the nightly rate, photos, and busy dates.
              It cannot change finance or HR. One room calendar is shared with Airbnb, Booking.com, and direct bookings, so a date cannot be sold twice.
            </p>
          </div>
          <span className="rounded-full border border-foreground/10 px-2 py-1 text-xs font-semibold text-muted">
            {pellowsStatus === "ACTIVE" ? "On" : "Off"}
          </span>
        </div>

        {pellowsStatus !== "ACTIVE" ? (
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              run(() => enablePellowsChannel(tenantSlug, consent), "Pellows is on. Copy the token now.");
            }}
          >
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-1"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>
                Pellows may read apartments, photos, nightly rates, and busy dates for this workspace only. It may not edit finance or HR.
              </span>
            </label>
            <button
              type="submit"
              disabled={pending || !consent}
              className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
            >
              Turn on Pellows
            </button>
          </form>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => rotatePellowsChannelToken(tenantSlug), "New token ready. Copy it now.")}
              className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold"
            >
              Rotate token
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => revokePellowsChannel(tenantSlug), "Pellows is off. The old token no longer works.")}
              className="rounded-md border border-[var(--danger-line)] px-3 py-2 text-xs font-semibold text-[var(--danger)]"
            >
              Turn off
            </button>
          </div>
        )}

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-muted">Tenant id</dt>
            <dd className="mt-1 flex items-center gap-2">
              <code className="rounded-md border border-foreground/15 bg-field px-2 py-1 font-mono text-xs">{tenantId}</code>
              <button type="button" className="text-xs font-semibold underline" onClick={() => void copy(tenantId)}>
                Copy
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-muted">Connection token</dt>
            <dd className="mt-1 text-xs text-muted">
              {revealedToken ? (
                <span className="flex flex-wrap items-center gap-2">
                  <code className="break-all rounded-md border border-foreground/15 bg-field px-2 py-1 font-mono text-foreground">
                    {revealedToken}
                  </code>
                  <button type="button" className="font-semibold underline" onClick={() => void copy(revealedToken)}>
                    Copy
                  </button>
                </span>
              ) : pellowsStatus === "ACTIVE" ? (
                <span>Saved. Prefix {tokenPrefix}. Copy it only when you turn Pellows on or rotate it.</span>
              ) : (
                <span>Shown once, after you turn Pellows on.</span>
              )}
              {lastUsedLabel ? <span className="mt-1 block">Last sync {lastUsedLabel}.</span> : null}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">
          Pellows calls <code className="font-mono">GET /v1/shortlets/units?tenantId=</code> with this token. Limit is 60 calls an hour.
          Later changes are sent to them as they happen, and they can catch up with <code className="font-mono">updatedSince</code>.
          A revoked token returns 401. A token used with another workspace id returns 403.
        </p>
      </section>

      <section className="rounded-xl border border-foreground/10 p-4">
        <h2 className="text-lg font-semibold">Booking calendar</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Each apartment has one calendar. Paste it into Airbnb or Booking.com. Paste their calendar back here so their busy dates block the room in Realcorp and on Pellows.
        </p>

        {feeds.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Add an active apartment before connecting a calendar.</p>
        ) : (
          <ul className="mt-3 divide-y divide-foreground/10 text-sm">
            {feeds.map((feed) => (
              <li key={feed.unitId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{feed.unitName}</span>
                <button type="button" className="text-xs font-semibold underline" onClick={() => void copy(feed.icalUrl)}>
                  Copy calendar link
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => saveChannelCalendarImport(tenantSlug, form),
              "Calendar saved. Busy dates now block this apartment.",
            );
          }}
        >
          <UiSelect value={form.unitId} onChange={(event) => setForm((current) => ({ ...current, unitId: event.target.value }))}>
            {feeds.map((feed) => (
              <option key={feed.unitId} value={feed.unitId}>
                {feed.unitName}
              </option>
            ))}
          </UiSelect>
          <UiSelect value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}>
            <option value="AIRBNB">Airbnb</option>
            <option value="BOOKING_COM">Booking.com</option>
            <option value="ICAL">Other calendar</option>
          </UiSelect>
          <input
            value={form.icalUrl}
            onChange={(event) => setForm((current) => ({ ...current, icalUrl: event.target.value }))}
            placeholder="https:// calendar link"
            className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm lg:col-span-1"
          />
          <button
            type="submit"
            disabled={pending || feeds.length === 0}
            className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
          >
            Save and sync
          </button>
        </form>

        {imports.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {imports.map((row) => (
              <li key={row.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {row.unitName} · {row.providerLabel}
                  </p>
                  <span className="flex gap-3 text-xs font-semibold">
                    <button
                      type="button"
                      disabled={pending}
                      className="underline"
                      onClick={() => run(() => syncChannelCalendarImport(tenantSlug, row.id), "Calendar synced.")}
                    >
                      Sync
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="text-[var(--danger)] underline"
                      onClick={() => run(() => removeChannelCalendarImport(tenantSlug, row.id), "Calendar removed.")}
                    >
                      Remove
                    </button>
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted">{row.icalUrl}</p>
                <p className="mt-1 text-xs text-muted">
                  {row.lastError || (row.lastSyncedLabel ? `Synced ${row.lastSyncedLabel}` : "Not synced yet")}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
