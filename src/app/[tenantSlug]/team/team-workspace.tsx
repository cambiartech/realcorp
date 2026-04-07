"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MembershipRole } from "@/generated/prisma";
import { FormAlert, FormFieldError } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { TEAM_MEMBERSHIP_ROLE_OPTIONS } from "@/lib/team-membership-roles";
import { parseTeamInviteForm, zodTeamInviteIssuesToFieldRecord, type TeamInviteFieldName } from "@/lib/validators/team-invite";
import { inviteTenantMember, updateMembershipRole, type TeamInviteResult } from "./actions";

const initial: TeamInviteResult | null = null;

type TeamMemberRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleValue: MembershipRole;
};

type PendingInviteRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};

const inputBase =
  "w-full border px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2";

function fieldClass(invalid: boolean) {
  return [
    inputBase,
    "bg-field",
    invalid
      ? "border-error ring-2 ring-error/20 focus:ring-error/25"
      : "border-foreground/15 focus:ring-foreground/20 dark:border-foreground/20",
  ].join(" ");
}

export function TeamWorkspace({
  tenantName,
  tenantSlug,
  canInvite,
  members,
  invites,
}: {
  tenantName: string;
  tenantSlug: string;
  canInvite: boolean;
  members: TeamMemberRow[];
  invites: PendingInviteRow[];
}) {
  const [activeTab, setActiveTab] = useState<"members" | "invites">("members");
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const inviteCount = invites.length;
  const memberCount = members.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="mt-1 text-sm text-muted">Manage members and invitations for {tenantName}.</p>
        </div>
        {canInvite ? (
          <button
            type="button"
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Invite team member
          </button>
        ) : null}
      </div>

      {!canInvite ? (
        <p className="mt-4 rounded-lg border border-foreground/10 bg-field px-3 py-2 text-sm text-muted">
          Only org admins can create invites.
        </p>
      ) : null}

      <div className="mt-4 rounded-lg border border-dashed border-foreground/20 bg-foreground/[0.02] px-4 py-3 text-xs text-muted">
        <p className="font-medium text-foreground">One job role per person</p>
        <p className="mt-1 leading-relaxed">
          Each member appears once and has a single <strong className="font-medium text-foreground/85">Job role</strong> (Finance manager, Sales manager, etc.). The app does{" "}
          <strong className="font-medium text-foreground/85">not</strong> support two roles on the same login—e.g. Finance manager and Sales manager together. Someone who covers both
          areas should use the role that matches their <strong className="font-medium text-foreground/85">main</strong> responsibilities, or{" "}
          <strong className="font-medium text-foreground/85">Org admin</strong> if they need the combined powers of both.{" "}
          <span className="text-foreground/70">
            Settings → Modules can add extra <em>sidebar</em> areas (Marketing, Community, Finance) for a role, but it does not merge manager-level permissions from two job roles.
          </span>
        </p>
      </div>

      <div className="mt-6 border-b border-foreground/10">
        <div className="flex gap-5">
          <TabButton
            active={activeTab === "members"}
            label={`Active members (${memberCount})`}
            onClick={() => setActiveTab("members")}
          />
          <TabButton
            active={activeTab === "invites"}
            label={`Pending invites (${inviteCount})`}
            onClick={() => setActiveTab("invites")}
          />
        </div>
      </div>

      {activeTab === "members" ? (
        <MembersTable members={members} tenantSlug={tenantSlug} canManageRoles={canInvite} />
      ) : (
        <InvitesTable invites={invites} />
      )}

      {isInviteOpen && canInvite ? (
        <InviteModal tenantSlug={tenantSlug} onClose={() => setIsInviteOpen(false)} />
      ) : null}
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative py-2 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted hover:text-foreground",
      ].join(" ")}
    >
      {label}
      <span
        className={[
          "absolute -bottom-px left-0 h-0.5 w-full transition-colors",
          active ? "bg-foreground" : "bg-transparent",
        ].join(" ")}
      />
    </button>
  );
}

function MembersTable({
  members,
  tenantSlug,
  canManageRoles,
}: {
  members: TeamMemberRow[];
  tenantSlug: string;
  canManageRoles: boolean;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleRoleChange(memberId: string, previousRole: MembershipRole, nextRole: string) {
    if (nextRole === previousRole) return;
    setPendingId(memberId);
    const fd = new FormData();
    fd.set("membershipId", memberId);
    fd.set("role", nextRole);
    const result = await updateMembershipRole(tenantSlug, fd);
    setPendingId(null);
    if (result.ok) {
      showSnackbar("Role updated.", "success");
    } else {
      showSnackbar(result.error, "error");
    }
    router.refresh();
  }

  if (members.length === 0) {
    return <EmptyState title="No team members yet." hint="Use Invite team member to onboard your first teammate." />;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-foreground/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="min-w-[200px] px-4 py-3">Job role</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/10">
          {members.map((member) => (
            <tr key={member.id}>
              <td className="px-4 py-3 font-medium text-foreground">{member.name}</td>
              <td className="px-4 py-3 text-muted">{member.email}</td>
              <td className="px-4 py-3">
                {canManageRoles ? (
                  <UiSelect
                    aria-label={`Role for ${member.name}`}
                    value={member.roleValue}
                    disabled={pendingId === member.id}
                    onChange={(e) => void handleRoleChange(member.id, member.roleValue, e.target.value)}
                    className="text-sm"
                  >
                    {TEAM_MEMBERSHIP_ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </UiSelect>
                ) : (
                  <span className="text-foreground/90">{member.role}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canManageRoles ? (
        <p className="border-t border-foreground/10 bg-foreground/[0.02] px-4 py-2 text-xs text-muted">
          Job role controls the default sidebar (e.g. <strong className="font-medium text-foreground/80">Marketing manager</strong>). Only{" "}
          <strong className="font-medium text-foreground/80">organization admins</strong> see <strong className="font-medium text-foreground/80">Team</strong> in
          the nav. Use Settings → Modules for optional add-ons and org-wide toggles.
        </p>
      ) : null}
    </div>
  );
}

function InvitesTable({ invites }: { invites: PendingInviteRow[] }) {
  if (invites.length === 0) {
    return <EmptyState title="No pending invites." hint="New invites will appear here until they are accepted." />;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-foreground/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Expires</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/10">
          {invites.map((invite) => (
            <tr key={invite.id}>
              <td className="px-4 py-3 font-medium text-foreground">{invite.email}</td>
              <td className="px-4 py-3 text-foreground/90">{invite.role}</td>
              <td className="px-4 py-3 text-muted">{invite.expiresAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mt-4 rounded-lg border border-foreground/10 bg-field px-4 py-8 text-sm">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-muted">{hint}</p>
    </div>
  );
}

function InviteModal({ tenantSlug, onClose }: { tenantSlug: string; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(inviteTenantMember.bind(null, tenantSlug), initial);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TeamInviteFieldName, string>>>({});
  const { showSnackbar } = useSnackbar();
  const seenStateRef = useRef<string>("");

  const hasSuccess = Boolean(state?.ok);
  const successUrl = useMemo(() => (state?.ok ? state.inviteUrl : ""), [state]);

  useEffect(() => {
    if (!state) return;
    const key = state.ok ? `ok:${state.inviteUrl}` : `err:${state.error}`;
    if (seenStateRef.current === key) return;
    seenStateRef.current = key;
    if (state.ok) showSnackbar("Invite created successfully.", "success");
    else showSnackbar(state.error, "error");
  }, [showSnackbar, state]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const parsed = parseTeamInviteForm(formData);
    if (!parsed.success) {
      setFieldErrors(zodTeamInviteIssuesToFieldRecord(parsed.error.issues));
      return;
    }
    setFieldErrors({});
    formAction(formData);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Invite team member</h2>
            <p className="mt-1 text-sm text-muted">Send a role-based invitation link.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label="Close modal"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {hasSuccess ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted">Invite created. Share this link:</p>
            <p className="break-all rounded-md border border-foreground/10 bg-field p-3 font-mono text-xs text-foreground">
              {successUrl}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-4">
            {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}

            <div>
              <label htmlFor="team-modal-email" className="mb-1 block text-sm text-muted">
                Email
              </label>
              <input
                id="team-modal-email"
                name="email"
                type="text"
                inputMode="email"
                autoComplete="email"
                placeholder="user@company.com"
                className={fieldClass(Boolean(fieldErrors.email))}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "team-modal-email-error" : undefined}
              />
              {fieldErrors.email ? <FormFieldError id="team-modal-email-error">{fieldErrors.email}</FormFieldError> : null}
            </div>

            <div>
              <label htmlFor="team-modal-role" className="mb-1 block text-sm text-muted">
                Role
              </label>
              <UiSelect
                id="team-modal-role"
                name="role"
                defaultValue={MembershipRole.SALES_EXECUTIVE}
                aria-invalid={Boolean(fieldErrors.role)}
                aria-describedby={fieldErrors.role ? "team-modal-role-error" : undefined}
                invalid={Boolean(fieldErrors.role)}
              >
                {TEAM_MEMBERSHIP_ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </UiSelect>
              {fieldErrors.role ? <FormFieldError id="team-modal-role-error">{fieldErrors.role}</FormFieldError> : null}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Creating invite…" : "Create invite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
