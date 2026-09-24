"use client";

import { useState, useTransition, type ReactNode } from "react";
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
  inquiryCount: number;
  inquiries: ReactNode;
};

type TabId = "pellows" | "calendars" | "inquiries";

export function ChannelConnections({
  tenantSlug,
  tenantId,
  pellowsStatus,
  lastUsedLabel,
  feeds,
  imports,
  inquiryCount,
  inquiries,
}: Props) {
  const { showSnackbar } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<TabId>("pellows");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [copyUnitId, setCopyUnitId] = useState(feeds[0]?.unitId || "");
  const [form, setForm] = useState({ unitId: feeds[0]?.unitId || "", provider: "AIRBNB", icalUrl: "" });
  const on = pellowsStatus === "ACTIVE";

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

  const copyFeed = feeds.find((feed) => feed.unitId === copyUnitId) || feeds[0];

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "pellows", label: "Pellows" },
    { id: "calendars", label: "Calendars" },
    { id: "inquiries", label: inquiryCount > 0 ? `Inquiries ${inquiryCount}` : "Inquiries" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-foreground/10 p-0.5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              "rounded-md px-3 py-1.5 text-xs font-semibold",
              tab === item.id ? "bg-foreground text-background" : "text-muted",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "pellows" ? (
      <section className="rounded-xl border border-foreground/10 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Pellows</h2>
            <p className="mt-1 text-sm text-muted">
              {on
                ? lastUsedLabel
                  ? `Connected. Last checked ${lastUsedLabel}.`
                  : "Connected. Waiting for Pellows to check in."
                : "Let guests book these apartments on Pellows."}
            </p>
          </div>
          <span
            className={[
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
              on ? "bg-foreground text-background" : "text-muted",
            ].join(" ")}
          >
            {on ? "On" : "Off"}
          </span>
        </div>

        {revealedToken ? (
          <div className="mt-4 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
            <p className="text-sm font-medium">Paste these into Pellows</p>
            <p className="mt-1 text-xs text-muted">Copy the code now. It will not be shown again.</p>
            <CopyLine label="Workspace" value={tenantId} onCopy={() => void copy(tenantId)} />
            <CopyLine label="Code" value={revealedToken} onCopy={() => void copy(revealedToken)} />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {on ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => revokePellowsChannel(tenantSlug), "Pellows is off.")}
              className="text-xs font-semibold text-muted underline disabled:opacity-50"
            >
              Turn off
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => enablePellowsChannel(tenantSlug, true), "Pellows is on. Copy the code now.")}
              className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
            >
              Turn on
            </button>
          )}
          {!on ? (
            <p className="text-xs text-muted">Pellows will see apartments, prices, photos, and busy dates.</p>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => rotatePellowsChannelToken(tenantSlug), "New code ready. Copy it now.")}
              className="text-xs font-semibold text-muted underline disabled:opacity-50"
            >
              New code
            </button>
          )}
        </div>
      </section>
      ) : null}

      {tab === "calendars" ? (
          <div className="space-y-4 rounded-xl border border-foreground/10 px-5 py-4">
            <p className="text-sm text-muted">Busy dates on these calendars block the same room everywhere.</p>

            {feeds.length > 0 ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-[180px] flex-1 text-xs text-muted">
                  Room calendar
                  <UiSelect
                    className="mt-1"
                    value={copyFeed?.unitId || ""}
                    onChange={(event) => setCopyUnitId(event.target.value)}
                  >
                    {feeds.map((feed) => (
                      <option key={feed.unitId} value={feed.unitId}>
                        {feed.unitName}
                      </option>
                    ))}
                  </UiSelect>
                </label>
                <button
                  type="button"
                  disabled={!copyFeed}
                  onClick={() => copyFeed && void copy(copyFeed.icalUrl)}
                  className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold"
                >
                  Copy link
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted">Add an apartment first.</p>
            )}

            {imports.length > 0 ? (
              <ul className="divide-y divide-foreground/10 text-sm">
                {imports.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {row.unitName} · {row.providerLabel}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {row.lastError || (row.lastSyncedLabel ? `Updated ${row.lastSyncedLabel}` : "Not updated yet")}
                      </p>
                    </div>
                    <span className="flex shrink-0 gap-3 text-xs font-semibold">
                      <button
                        type="button"
                        disabled={pending}
                        className="underline"
                        onClick={() => run(() => syncChannelCalendarImport(tenantSlug, row.id), "Updated.")}
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="text-muted underline"
                        onClick={() => run(() => removeChannelCalendarImport(tenantSlug, row.id), "Removed.")}
                      >
                        Remove
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            {linkOpen ? (
              <form
                className="grid gap-2 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(() => saveChannelCalendarImport(tenantSlug, form), "Calendar linked.");
                  setForm((current) => ({ ...current, icalUrl: "" }));
                }}
              >
                <UiSelect
                  value={form.unitId}
                  onChange={(event) => setForm((current) => ({ ...current, unitId: event.target.value }))}
                >
                  {feeds.map((feed) => (
                    <option key={feed.unitId} value={feed.unitId}>
                      {feed.unitName}
                    </option>
                  ))}
                </UiSelect>
                <UiSelect
                  value={form.provider}
                  onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
                >
                  <option value="AIRBNB">Airbnb</option>
                  <option value="BOOKING_COM">Booking.com</option>
                  <option value="ICAL">Other</option>
                </UiSelect>
                <input
                  value={form.icalUrl}
                  onChange={(event) => setForm((current) => ({ ...current, icalUrl: event.target.value }))}
                  placeholder="Paste the calendar link"
                  className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm sm:col-span-2"
                />
                <div className="flex gap-3 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={pending || feeds.length === 0}
                    className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
                  >
                    Link calendar
                  </button>
                  <button type="button" className="text-xs font-semibold text-muted" onClick={() => setLinkOpen(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button type="button" className="text-xs font-semibold underline" onClick={() => setLinkOpen(true)}>
                Link an Airbnb or Booking.com calendar
              </button>
            )}

          </div>
      ) : null}

      {tab === "inquiries" ? inquiries : null}
    </div>
  );
}

function CopyLine({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="mt-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <code className="break-all font-mono text-xs text-foreground">{value}</code>
        <button type="button" onClick={onCopy} className="shrink-0 text-xs font-semibold underline">
          Copy
        </button>
      </div>
    </div>
  );
}
