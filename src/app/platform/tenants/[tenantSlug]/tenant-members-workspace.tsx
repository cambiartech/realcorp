"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSnackbar } from "@/components/snackbar";
import { ButtonSpinner } from "@/components/button-spinner";
import { platformPurgeTenantMember, platformRemoveTenantMember } from "../../actions";

export type PlatformMemberRow = {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  isDepartmentLead: boolean;
  joinedAtLabel: string;
  isPlatformAdmin: boolean;
};

export function TenantMembersWorkspace({
  tenantSlug,
  tenantName,
  members,
}: {
  tenantSlug: string;
  tenantName: string;
  members: PlatformMemberRow[];
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  async function handleRemove(member: PlatformMemberRow) {
    const label = member.email || member.name;
    if (
      !window.confirm(
        `Remove ${label} from ${tenantName}?\n\nThis clears their membership, pending invites, HR profile, and dashboard prefs for this org. Their login account stays intact.`,
      )
    ) {
      return;
    }

    setPendingKey(`${member.userId}:remove`);
    const result = await platformRemoveTenantMember(tenantSlug, member.userId);
    setPendingKey(null);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar(`${label} removed from ${tenantName}.`, "success");
    router.refresh();
  }

  async function handlePurge(member: PlatformMemberRow) {
    const label = member.email || member.name;
    if (member.isPlatformAdmin) {
      showSnackbar("Platform administrator accounts cannot be deleted.", "error");
      return;
    }
    if (
      !window.confirm(
        `Permanently delete ${label}?\n\nThis removes them from ${tenantName} AND deletes their login account (sessions, passwords, OAuth links). Use this to retest onboarding invites from scratch.\n\nThis cannot be undone.`,
      )
    ) {
      return;
    }

    setPendingKey(`${member.userId}:purge`);
    const result = await platformPurgeTenantMember(tenantSlug, member.userId);
    setPendingKey(null);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar(`Account for ${label} deleted. You can invite them again.`, "success");
    router.refresh();
  }

  return (
    <section className="border border-foreground/10">
      <div className="border-b border-foreground/10 bg-foreground/[0.03] px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Members</h2>
        <p className="mt-0.5 text-xs text-muted">
          Remove users from this org or delete their account entirely to retest invites and onboarding.
        </p>
      </div>

      {members.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">No active members yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-foreground/10 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const removeBusy = pendingKey === `${member.userId}:remove`;
                const purgeBusy = pendingKey === `${member.userId}:purge`;
                const busy = removeBusy || purgeBusy;
                return (
                  <tr key={member.membershipId} className="border-b border-foreground/5">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {member.name}
                      {member.isPlatformAdmin ? (
                        <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                          Platform
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground/90">{member.email || "—"}</td>
                    <td className="px-4 py-3 text-muted">
                      {member.role}
                      {member.department ? (
                        <span className="block text-[11px] text-muted/80">
                          {member.department}
                          {member.isDepartmentLead ? " · lead" : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted">{member.joinedAtLabel}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleRemove(member)}
                          className="inline-flex items-center gap-1.5 border border-foreground/20 px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.04] disabled:opacity-50"
                        >
                          {removeBusy ? <ButtonSpinner /> : null}
                          Remove from org
                        </button>
                        <button
                          type="button"
                          disabled={busy || member.isPlatformAdmin}
                          onClick={() => void handlePurge(member)}
                          className="inline-flex items-center gap-1.5 border border-[var(--danger)]/40 px-2.5 py-1.5 text-xs font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/5 disabled:opacity-50"
                        >
                          {purgeBusy ? <ButtonSpinner /> : null}
                          Delete account
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
