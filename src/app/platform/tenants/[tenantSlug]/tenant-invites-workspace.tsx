"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSnackbar } from "@/components/snackbar";
import { ButtonSpinner } from "@/components/button-spinner";
import {
  platformCreateAdminInvite,
  platformRefreshInvitationToken,
  platformResendInvitation,
} from "../../actions";

export type PlatformInviteRow = {
  id: string;
  email: string;
  role: string;
  status: "valid" | "expired" | "accepted";
  statusLabel: string;
  expiresAtLabel: string;
  acceptedAtLabel: string | null;
  createdAtLabel: string;
  inviteUrl: string | null;
  canResend: boolean;
  canRefresh: boolean;
};

export function TenantInvitesWorkspace({
  tenantSlug,
  tenantName,
  invites,
  hasActiveOrgAdmin,
}: {
  tenantSlug: string;
  tenantName: string;
  invites: PlatformInviteRow[];
  hasActiveOrgAdmin: boolean;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      showSnackbar("Invite link copied.", "success");
    } catch {
      showSnackbar("Could not copy — select and copy the link manually.", "info");
    }
  }

  async function handleResend(invite: PlatformInviteRow) {
    setPendingId(invite.id);
    const result = await platformResendInvitation(tenantSlug, invite.id);
    setPendingId(null);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar(result.emailSent ? `Email sent to ${invite.email}.` : `Link ready — email failed: ${result.emailError}`, result.emailSent ? "success" : "info");
    if (result.inviteUrl) void copyLink(result.inviteUrl);
    router.refresh();
  }

  async function handleRefresh(invite: PlatformInviteRow) {
    setPendingId(invite.id);
    const result = await platformRefreshInvitationToken(tenantSlug, invite.id);
    setPendingId(null);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar(
      result.emailSent
        ? `New link generated and emailed to ${invite.email}.`
        : `New link generated — email failed: ${result.emailError}`,
      result.emailSent ? "success" : "info",
    );
    if (result.inviteUrl) void copyLink(result.inviteUrl);
    router.refresh();
  }

  async function handleCreateAdminInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email || creating) return;
    setCreating(true);
    const result = await platformCreateAdminInvite(tenantSlug, email);
    setCreating(false);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar(
      result.emailSent ? `Invite sent to ${email}.` : `Invite created — email failed: ${result.emailError}`,
      result.emailSent ? "success" : "info",
    );
    if (result.inviteUrl) void copyLink(result.inviteUrl);
    setNewEmail("");
    router.refresh();
  }

  const pendingInvites = invites.filter((i) => i.canResend || i.canRefresh);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 text-sm text-muted">
        <p className="font-medium text-foreground">Why invite links fail</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            <strong className="text-foreground">Expired</strong> — links last 14 days; use Refresh token.
          </li>
          <li>
            <strong className="text-foreground">Email never sent</strong> — Resend copies a fresh link; check RESEND_API_KEY in production.
          </li>
          <li>
            <strong className="text-foreground">Wrong URL</strong> — link must match{" "}
            <code className="text-xs">NEXT_PUBLIC_APP_URL</code> (currently used when generating invites).
          </li>
          <li>
            <strong className="text-foreground">Already used</strong> — member already joined; they should sign in at /login.
          </li>
        </ul>
        {hasActiveOrgAdmin ? (
          <p className="mt-3 text-foreground/90">This org already has an active org admin who can sign in.</p>
        ) : null}
      </div>

      {pendingInvites.length === 0 ? (
        <div className="rounded-lg border border-dashed border-foreground/20 px-6 py-8 text-center text-sm text-muted">
          No pending invites. Create a new org-admin invite below.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-foreground/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {pendingInvites.map((invite) => (
                <tr key={invite.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{invite.email}</td>
                  <td className="px-4 py-3 text-muted">{invite.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-block rounded px-2 py-0.5 text-xs font-medium",
                        invite.status === "valid"
                          ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                          : invite.status === "expired"
                            ? "bg-amber-500/10 text-amber-900 dark:text-amber-200"
                            : "bg-foreground/10 text-muted",
                      ].join(" ")}
                    >
                      {invite.statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{invite.expiresAtLabel}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {invite.inviteUrl ? (
                        <button
                          type="button"
                          onClick={() => void copyLink(invite.inviteUrl!)}
                          className="text-xs text-muted underline underline-offset-2 hover:text-foreground"
                        >
                          Copy link
                        </button>
                      ) : null}
                      {invite.canResend ? (
                        <button
                          type="button"
                          disabled={pendingId === invite.id}
                          onClick={() => void handleResend(invite)}
                          className="text-xs text-foreground underline underline-offset-2 disabled:opacity-40"
                        >
                          {pendingId === invite.id ? "Sending…" : "Resend email"}
                        </button>
                      ) : null}
                      {invite.canRefresh ? (
                        <button
                          type="button"
                          disabled={pendingId === invite.id}
                          onClick={() => void handleRefresh(invite)}
                          className="text-xs font-semibold text-foreground underline underline-offset-2 disabled:opacity-40"
                        >
                          {pendingId === invite.id ? "Working…" : "Refresh token"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invites.some((i) => i.status === "accepted") ? (
        <div>
          <h2 className="text-sm font-semibold text-foreground">Accepted invites</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {invites
              .filter((i) => i.status === "accepted")
              .map((i) => (
                <li key={i.id}>
                  {i.email} — joined {i.acceptedAtLabel}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <section className="rounded-lg border border-foreground/10 p-5">
        <h2 className="text-base font-semibold text-foreground">New org-admin invite</h2>
        <p className="mt-1 text-sm text-muted">
          Use when the original link was lost, email failed, or you need to invite a different admin.
        </p>
        <form onSubmit={handleCreateAdminInvite} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block text-xs text-muted">Admin email</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="admin@company.com"
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={creating || !newEmail.trim()}
            className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {creating ? <ButtonSpinner /> : null}
            {creating ? "Creating…" : "Create & send invite"}
          </button>
        </form>
      </section>
    </div>
  );
}
