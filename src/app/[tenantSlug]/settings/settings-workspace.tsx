"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { MembershipRole } from "@/generated/prisma";
import {
  EXTRA_MODULE_GRANT_TOKENS,
  grantFormFieldName,
  MEMBERSHIP_ROLES_FOR_GRANT_MATRIX,
  parseRoleGrantsJsonString,
  type ExtraModuleGrantToken,
} from "@/lib/role-module-grants-form";
import { formatEnumLabel } from "@/lib/ui-format";
import {
  updateMyDisplayName,
  updateMyPassword,
  updateOrganizationName,
  updateOrgModules,
} from "./actions";
import { FormAlert } from "@/components/form-message";

type WorkspaceMeta = {
  slug: string;
  statusLabel: string;
  planLabel: string;
  roleLabel: string;
  membershipLabel: string;
  currency: string;
  timezone: string;
};

type SettingsWorkspaceProps = {
  tenantSlug: string;
  tenantName: string;
  userDisplayName: string;
  userEmail: string | null;
  canManageOrg: boolean;
  modules: {
    moduleSales: boolean;
    moduleFinance: boolean;
    moduleMarketing: boolean;
    moduleCommunity: boolean;
    moduleRealtorPortal: boolean;
  };
  roleModuleGrantsJson: string;
  workspaceMeta: WorkspaceMeta;
};

type TabId = "profile" | "organization" | "modules" | "about";

export function SettingsWorkspace({
  tenantSlug,
  tenantName,
  userDisplayName,
  userEmail,
  canManageOrg,
  modules,
  roleModuleGrantsJson,
  workspaceMeta,
}: SettingsWorkspaceProps) {
  const tabDefs: { id: TabId; label: string }[] = [
    { id: "profile", label: "Profile" },
    ...(canManageOrg
      ? ([
          { id: "organization", label: "Organization" },
          { id: "modules", label: "Modules & access" },
        ] as const)
      : []),
    { id: "about", label: "Workspace" },
  ];

  const [tab, setTab] = useState<TabId>("profile");

  const [profileState, profileAction, profilePending] = useActionState(
    updateMyDisplayName.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    updateMyPassword.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );
  const [orgNameState, orgNameAction, orgNamePending] = useActionState(
    updateOrganizationName.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );
  const [modulesState, modulesAction, modulesPending] = useActionState(
    updateOrgModules.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );

  const initialRoleGrants = useMemo(() => parseRoleGrantsJsonString(roleModuleGrantsJson), [roleModuleGrantsJson]);

  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02]">
      <div className="border-b border-foreground/10 px-5 pt-4" role="tablist" aria-label="Settings sections">
        <div className="flex flex-wrap gap-5">
          {tabDefs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              id={`settings-tab-${t.id}`}
              aria-controls={`settings-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={["relative py-2 text-sm font-medium", tab === t.id ? "text-foreground" : "text-muted"].join(" ")}
            >
              {t.label}
              <span
                className={[
                  "absolute -bottom-px left-0 h-0.5 w-full",
                  tab === t.id ? "bg-foreground" : "bg-transparent",
                ].join(" ")}
                aria-hidden
              />
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {tab === "profile" ? (
          <div
            id="settings-panel-profile"
            role="tabpanel"
            aria-labelledby="settings-tab-profile"
            className="space-y-8"
          >
            <div>
              <h2 className="text-sm font-semibold text-foreground">Your profile</h2>
              <p className="mt-1 text-xs text-muted">
                How your name appears to teammates. Email is your sign-in and cannot be changed here.
              </p>
              {profileState && !profileState.ok ? (
                <div className="mt-2">
                  <FormAlert>{profileState.error}</FormAlert>
                </div>
              ) : null}
              {profileState?.ok ? (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Profile updated.</p>
              ) : null}
              <form action={profileAction} className="mt-4 space-y-3">
                <div>
                  <label htmlFor="displayName" className="mb-1 block text-xs font-medium text-muted">
                    Display name
                  </label>
                  <input
                    id="displayName"
                    name="displayName"
                    defaultValue={userDisplayName}
                    className="w-full max-w-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Email</label>
                  <p className="text-sm text-foreground/80">{userEmail || "—"}</p>
                </div>
                <button
                  type="submit"
                  disabled={profilePending}
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {profilePending ? "Saving…" : "Save profile"}
                </button>
              </form>
            </div>

            <div className="border-t border-foreground/10 pt-8">
              <h2 className="text-sm font-semibold text-foreground">Password</h2>
              <p className="mt-1 text-xs text-muted">Change the password you use to sign in.</p>
              {passwordState && !passwordState.ok ? (
                <div className="mt-2">
                  <FormAlert>{passwordState.error}</FormAlert>
                </div>
              ) : null}
              {passwordState?.ok ? (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Password updated. Use it next time you sign in.</p>
              ) : null}
              <form action={passwordAction} className="mt-4 max-w-md space-y-3">
                <div>
                  <label htmlFor="currentPassword" className="mb-1 block text-xs font-medium text-muted">
                    Current password
                  </label>
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="newPassword" className="mb-1 block text-xs font-medium text-muted">
                    New password
                  </label>
                  <input
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-1 block text-xs font-medium text-muted">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordPending}
                  className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
                >
                  {passwordPending ? "Updating…" : "Update password"}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {tab === "organization" && canManageOrg ? (
          <div
            id="settings-panel-organization"
            role="tabpanel"
            aria-labelledby="settings-tab-organization"
          >
            <h2 className="text-sm font-semibold text-foreground">Organization</h2>
            <p className="mt-1 text-xs text-muted">Name shown across the tenant workspace.</p>
            {orgNameState && !orgNameState.ok ? (
              <div className="mt-2">
                <FormAlert>{orgNameState.error}</FormAlert>
              </div>
            ) : null}
            {orgNameState?.ok ? (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Organization name updated.</p>
            ) : null}
            <form action={orgNameAction} className="mt-4 space-y-3">
              <div>
                <label htmlFor="organizationName" className="mb-1 block text-xs font-medium text-muted">
                  Organization name
                </label>
                <input
                  id="organizationName"
                  name="organizationName"
                  defaultValue={tenantName}
                  className="w-full max-w-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <button
                type="submit"
                disabled={orgNamePending}
                className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
              >
                {orgNamePending ? "Saving…" : "Save organization name"}
              </button>
            </form>
          </div>
        ) : null}

        {tab === "modules" && canManageOrg ? (
          <div id="settings-panel-modules" role="tabpanel" aria-labelledby="settings-tab-modules">
            <h2 className="text-sm font-semibold text-foreground">Modules & access</h2>
            <p className="mt-1 text-xs text-muted">
              First choose which modules exist for your organization. Then tick which <strong className="font-medium text-foreground/90">extra</strong> areas
              each role can open in the sidebar (for example, let sales see Marketing).
            </p>
            <p className="mt-2 text-xs text-muted">
              <strong className="font-medium text-foreground/90">Job roles</strong> (Org admin, Marketing manager, Sales executive, etc.) are set on{" "}
              <Link
                href={`/${tenantSlug}/team`}
                className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground/60"
              >
                Team
              </Link>
              : invite someone with that role, or change an existing member&apos;s <strong className="font-medium text-foreground/90">Job role</strong>{" "}
              dropdown (org admins). This page does not assign job titles—it only turns modules on for the org and adds optional sidebar extras per role.
            </p>
            {modulesState && !modulesState.ok ? (
              <div className="mt-2">
                <FormAlert>{modulesState.error}</FormAlert>
              </div>
            ) : null}
            {modulesState?.ok ? (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">Module settings saved.</p>
            ) : null}
            <form action={modulesAction} className="mt-4 space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Organization modules</p>
                <p className="mt-1 text-xs text-muted">When a module is off, nobody sees it—including extras below.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ModuleToggle name="moduleSales" label="Sales (dashboard, projects, leads, deals)" defaultChecked={modules.moduleSales} />
                  <ModuleToggle name="moduleFinance" label="Finance" defaultChecked={modules.moduleFinance} />
                  <ModuleToggle name="moduleMarketing" label="Marketing" defaultChecked={modules.moduleMarketing} />
                  <ModuleToggle name="moduleCommunity" label="Community" defaultChecked={modules.moduleCommunity} />
                  <ModuleToggle
                    name="moduleRealtorPortal"
                    label="Realtor portal"
                    defaultChecked={modules.moduleRealtorPortal}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
                <p className="text-sm font-semibold text-foreground">{formatEnumLabel(MembershipRole.ORG_ADMIN)}</p>
                <p className="mt-1 text-xs text-muted">
                  Always has the full sidebar for every module you enable above. No checkboxes needed.
                </p>
              </div>

              <div className="rounded-lg border border-dashed border-foreground/20 bg-background px-4 py-3">
                <p className="text-sm font-semibold text-foreground">How CRM, Team, and this grid work together</p>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs text-muted">
                  <li>
                    <span className="font-medium text-foreground/90">Sales (org-wide)</span> — The <strong className="text-foreground/90">Sales</strong> checkbox
                    under Organization modules must be on for anyone to use CRM pages. Turning it off hides Dashboard, Projects, Leads, and Deals for the whole
                    tenant.
                  </li>
                  <li>
                    <span className="font-medium text-foreground/90">Sales (per role)</span> — The <strong className="text-foreground/90">Sales</strong> column in
                    the grid adds the full CRM strip (dashboard, projects, leads, deals) for roles that don&apos;t already have all of them—e.g. give a{" "}
                    <strong className="text-foreground/90">Community manager</strong> CRM access, or add <strong className="text-foreground/90">Deals</strong> for a{" "}
                    <strong className="text-foreground/90">Marketing manager</strong> who already has projects and leads.
                  </li>
                  <li>
                    <span className="font-medium text-foreground/90">Team</span> — The <strong className="text-foreground/90">Team</strong> sidebar item and
                    members page are only for <strong className="text-foreground/90">organization admins</strong> (and platform admins). It is not in the grid
                    below.
                  </li>
                  <li>
                    <span className="font-medium text-foreground/90">Settings</span> — Still in everyone&apos;s sidebar for their own profile and (when allowed)
                    organization settings.
                  </li>
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Optional add-ons by role</p>
                <p className="mt-1 text-xs text-muted">
                  Sales, Marketing, Community, and Finance. Tick to add sidebar areas that role doesn&apos;t get by default. Greyed out = turn that organization
                  module on above first.
                </p>
                <RoleExtraAccessMatrix modules={modules} initialGrants={initialRoleGrants} />
              </div>

              <button
                type="submit"
                disabled={modulesPending}
                className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
              >
                {modulesPending ? "Saving…" : "Save modules"}
              </button>
            </form>
          </div>
        ) : null}

        {tab === "about" ? (
          <div id="settings-panel-about" role="tabpanel" aria-labelledby="settings-tab-about">
            <h2 className="text-sm font-semibold text-foreground">Workspace details</h2>
            <p className="mt-1 text-xs text-muted">Read-only context for your organization.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SettingCard label="Slug" value={workspaceMeta.slug} />
              <SettingCard label="Status" value={workspaceMeta.statusLabel} />
              <SettingCard label="Plan" value={workspaceMeta.planLabel} />
              <SettingCard label="Your role" value={workspaceMeta.roleLabel} />
              <SettingCard label="Membership" value={workspaceMeta.membershipLabel} />
              <SettingCard label="Currency" value={workspaceMeta.currency} />
              <SettingCard label="Timezone" value={workspaceMeta.timezone} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const EXTRA_COLUMN_META: Record<ExtraModuleGrantToken, { title: string; subtitle: string }> = {
  SALES: { title: "Sales", subtitle: "Dashboard, projects, leads, deals" },
  MARKETING: { title: "Marketing", subtitle: "Campaigns & insights" },
  COMMUNITY: { title: "Community", subtitle: "Community workspace" },
  FINANCE: { title: "Finance", subtitle: "Queue & invoices" },
};

const ROLE_GRANT_ROW_HINT: Partial<Record<MembershipRole, string>> = {
  [MembershipRole.SALES_EXECUTIVE]: "Default: core CRM, Settings.",
  [MembershipRole.SALES_MANAGER]: "Default: core CRM, Settings.",
  [MembershipRole.FINANCE_MANAGER]: "Default: core CRM, Finance, Settings.",
  [MembershipRole.MARKETING_MANAGER]: "Default: projects, leads, Marketing, Settings. Tick Sales to add Deals (full CRM strip).",
  [MembershipRole.COMMUNITY_MANAGER]: "Default: Community, Settings.",
};

function orgModuleAllowsGrant(
  modules: {
    moduleSales: boolean;
    moduleMarketing: boolean;
    moduleCommunity: boolean;
    moduleFinance: boolean;
  },
  token: ExtraModuleGrantToken,
): boolean {
  if (token === "SALES") return modules.moduleSales;
  if (token === "MARKETING") return modules.moduleMarketing;
  if (token === "COMMUNITY") return modules.moduleCommunity;
  return modules.moduleFinance;
}

function RoleExtraAccessMatrix({
  modules,
  initialGrants,
}: {
  modules: {
    moduleSales: boolean;
    moduleMarketing: boolean;
    moduleCommunity: boolean;
    moduleFinance: boolean;
  };
  initialGrants: Partial<Record<MembershipRole, ExtraModuleGrantToken[]>>;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-foreground/10">
      <table className="w-full min-w-[780px] text-left text-sm">
        <caption className="sr-only">
          Optional sidebar access: Sales, Marketing, Community, and Finance can be granted per role when org modules are on.
        </caption>
        <thead>
          <tr className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase tracking-wide">
            <th className="px-3 py-2 font-semibold text-muted">Role</th>
            {EXTRA_MODULE_GRANT_TOKENS.map((token) => {
              const on = orgModuleAllowsGrant(modules, token);
              const meta = EXTRA_COLUMN_META[token];
              return (
                <th key={token} className={["px-3 py-2 font-semibold normal-case", on ? "text-foreground" : "text-muted"].join(" ")}>
                  <span className="block">{meta.title}</span>
                  <span className="mt-0.5 block text-[10px] font-normal normal-case text-muted">{meta.subtitle}</span>
                  {!on ? <span className="mt-1 block text-[10px] font-normal text-muted">Module off</span> : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {MEMBERSHIP_ROLES_FOR_GRANT_MATRIX.map((role) => (
            <tr key={role} className="border-b border-foreground/10 last:border-b-0">
              <td className="align-top px-3 py-3">
                <p className="font-medium text-foreground">{formatEnumLabel(role)}</p>
                {ROLE_GRANT_ROW_HINT[role] ? (
                  <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-muted">{ROLE_GRANT_ROW_HINT[role]}</p>
                ) : null}
              </td>
              {EXTRA_MODULE_GRANT_TOKENS.map((token) => {
                const enabled = orgModuleAllowsGrant(modules, token);
                const checked = initialGrants[role]?.includes(token) ?? false;
                return (
                  <td key={token} className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      name={grantFormFieldName(role, token)}
                      defaultChecked={checked}
                      disabled={!enabled}
                      className="h-4 w-4 accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
                      title={
                        enabled
                          ? `Allow ${formatEnumLabel(role)} to open ${EXTRA_COLUMN_META[token].title}`
                          : `Turn on ${EXTRA_COLUMN_META[token].title} for the organization first`
                      }
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-background px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ModuleToggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1" />
      <span className="text-foreground">{label}</span>
    </label>
  );
}
