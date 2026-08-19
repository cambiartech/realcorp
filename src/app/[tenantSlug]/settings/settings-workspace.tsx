"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { MembershipRole } from "@/generated/prisma";
import {
  EXTRA_MODULE_GRANT_TOKENS,
  grantFormFieldName,
  MEMBERSHIP_ROLES_FOR_GRANT_MATRIX,
  parseRoleGrantsJsonString,
  type ExtraModuleGrantToken,
} from "@/lib/role-module-grants-form";
import { TENANT_MODULE_DEFINITIONS, TENANT_MODULE_GROUPS } from "@/lib/tenant-module-definitions";
import { membershipRoleLabel } from "@/lib/org-membership-profile";
import { formatEnumLabel } from "@/lib/ui-format";
import {
  getOrgLogoUploadSignature,
  saveIntegrationSettings,
  sendWhatsAppTestMessage,
  updateMyDisplayName,
  updateMyPassword,
  saveOrganizationBranding,
  saveOrganizationLogoUrl,
  updateOrganizationName,
  updateOrgModules,
  saveOrgDepartments,
} from "./actions";
import { FormAlert } from "@/components/form-message";
import { OrgDepartmentsEditor } from "@/components/org-departments-editor";
import { GlobalLocationFields } from "@/components/global-location-fields";
import { isDefaultOrgDepartment } from "@/lib/org-departments";
import { useSnackbar } from "@/components/snackbar";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";
import { ButtonSpinner } from "@/components/button-spinner";

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
    moduleShortLets: boolean;
    moduleHr: boolean;
    moduleTasks: boolean;
    moduleClients: boolean;
    moduleWhatsApp: boolean;
    moduleListings: boolean;
    moduleInvestorPortal: boolean;
    moduleFacility: boolean;
  };
  roleModuleGrantsJson: string;
  orgDepartments: string[];
  workspaceMeta: WorkspaceMeta;
  branding: {
    logoUrl: string | null;
    primaryColor: string;
    accentColor: string;
    orgEmail: string | null;
    orgPhone: string | null;
    orgAddressLine: string | null;
    orgCity: string | null;
    orgState: string | null;
    orgCountry: string | null;
    payrollCountryCode: string;
    nsitfRate: number;
    itfRate: number;
  };
  integrations: {
    metaVerifyToken: string | null;
    metaPageAccessToken: string | null;
    metaDefaultSource: string | null;
    termiiApiKey: string | null;
    termiiSenderId: string | null;
    whatsappAccessToken: string | null;
    whatsappPhoneNumberId: string | null;
    whatsappVerifyToken: string | null;
    whatsappBotEnabled: boolean;
    moduleWhatsApp?: boolean;
    logoUrl: string | null;
    financeBankAccounts: string[];
    financePaymentModes: string[];
    financeCurrencies: string[];
  };
};

type TabId = "profile" | "organization" | "modules" | "integrations" | "about";

export function SettingsWorkspace({
  tenantSlug,
  tenantName,
  userDisplayName,
  userEmail,
  canManageOrg,
  modules,
  roleModuleGrantsJson,
  orgDepartments,
  workspaceMeta,
  branding,
  integrations,
  initialTab,
}: SettingsWorkspaceProps & { initialTab?: TabId }) {
  const tabDefs: { id: TabId; label: string }[] = [
    { id: "profile", label: "Profile" },
    ...(canManageOrg
      ? ([
          { id: "organization", label: "Organization" },
          { id: "modules", label: "Modules & access" },
          { id: "integrations", label: "Integrations" },
        ] as const)
      : []),
    { id: "about", label: "Workspace" },
  ];

  const [tab, setTab] = useState<TabId>(() => {
    if (initialTab === "organization" && canManageOrg) return "organization";
    if (initialTab === "modules" && canManageOrg) return "modules";
    if (initialTab === "integrations") return "integrations";
    if (initialTab === "about") return "about";
    if (initialTab === "profile") return "profile";
    return "profile";
  });

  useEffect(() => {
    if (!initialTab) return;
    if (initialTab === "organization" && canManageOrg) setTab("organization");
    else if (initialTab === "modules" && canManageOrg) setTab("modules");
    else if (initialTab === "integrations") setTab("integrations");
    else if (initialTab === "about") setTab("about");
    else if (initialTab === "profile") setTab("profile");
  }, [initialTab, canManageOrg]);

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
  const [brandState, brandAction, brandPending] = useActionState(
    saveOrganizationBranding.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );
  const [modulesState, modulesAction, modulesPending] = useActionState(
    updateOrgModules.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );
  const [departmentsState, departmentsAction, departmentsPending] = useActionState(
    saveOrgDepartments.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );
  const [intState, intAction, intPending] = useActionState(
    saveIntegrationSettings.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(branding.logoUrl ?? integrations.logoUrl ?? "");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    setLogoUrl(branding.logoUrl ?? integrations.logoUrl ?? "");
  }, [branding.logoUrl, integrations.logoUrl]);

  useEffect(() => {
    if (brandState?.ok) {
      showSnackbar("Branding saved. Setup coach will show your next step.", "success");
      router.refresh();
    }
  }, [brandState, router, showSnackbar]);

  useEffect(() => {
    if (orgNameState?.ok) {
      showSnackbar("Organization name saved. Setup coach will show your next step.", "success");
      router.refresh();
    }
  }, [orgNameState, router, showSnackbar]);

  useEffect(() => {
    if (departmentsState?.ok) {
      showSnackbar("Departments saved. Available across Finance, HR, and reporting.", "success");
      router.refresh();
    }
  }, [departmentsState, router, showSnackbar]);

  function reportLogoIssue(message: string) {
    setLogoUploadError(message);
    showSnackbar(message, "error");
  }

  const initialRoleGrants = useMemo(
    () => parseRoleGrantsJsonString(roleModuleGrantsJson),
    [roleModuleGrantsJson],
  );
  const initialCustomDepartments = useMemo(
    () => orgDepartments.filter((x) => !isDefaultOrgDepartment(x)),
    [orgDepartments],
  );
  const [customDepartments, setCustomDepartments] = useState<string[]>(initialCustomDepartments);

  useEffect(() => {
    setCustomDepartments(initialCustomDepartments);
  }, [initialCustomDepartments]);

  useEffect(() => {
    if (typeof window === "undefined" || tab !== "organization") return;
    if (window.location.hash === "#org-departments") {
      document.getElementById("org-departments")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [tab]);

  async function handleLogoFileUpload(file: File) {
    if (logoUploading) return;
    if (!file.type.startsWith("image/")) {
      reportLogoIssue("Please upload an image file.");
      return;
    }
    setLogoUploading(true);
    setLogoUploadError(null);
    const sig = await getOrgLogoUploadSignature(tenantSlug, { fileName: file.name });
    if (!sig.ok) {
      reportLogoIssue(sig.error);
      setLogoUploading(false);
      return;
    }
    try {
      const uploaded = await uploadViaCloudinarySignature(file, sig);
      if (!uploaded.ok) {
        reportLogoIssue(uploaded.error);
        setLogoUploading(false);
        return;
      }
      setLogoUrl(uploaded.secureUrl);
      const saved = await saveOrganizationLogoUrl(tenantSlug, uploaded.secureUrl);
      if (!saved.ok) {
        reportLogoIssue(saved.error);
        setLogoUploading(false);
        return;
      }
      showSnackbar("Logo saved for your organization.", "success");
      router.refresh();
    } catch {
      reportLogoIssue("Could not upload logo right now.");
    } finally {
      setLogoUploading(false);
    }
  }

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
              className={[
                "relative py-2 text-sm font-medium",
                tab === t.id ? "text-foreground" : "text-muted",
              ].join(" ")}
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
                <p className="mt-2 text-xs text-[var(--success)]">Profile updated.</p>
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
                  aria-busy={profilePending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {profilePending ? <ButtonSpinner /> : null}
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
                <p className="mt-2 text-xs text-[var(--success)]">
                  Password updated. Use it next time you sign in.
                </p>
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
                  aria-busy={passwordPending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground/20 px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
                >
                  {passwordPending ? <ButtonSpinner /> : null}
                  {passwordPending ? "Updating…" : "Update password"}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {tab === "organization" && canManageOrg ? (
          <div id="settings-panel-organization" role="tabpanel" aria-labelledby="settings-tab-organization">
            <h2 className="text-sm font-semibold text-foreground">Organization</h2>
            <p className="mt-1 text-xs text-muted">Name shown across the tenant workspace.</p>
            {orgNameState && !orgNameState.ok ? (
              <div className="mt-2">
                <FormAlert>{orgNameState.error}</FormAlert>
              </div>
            ) : null}
            {orgNameState?.ok ? (
              <p className="mt-2 text-xs text-[var(--success)]">Organization name updated.</p>
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
                aria-busy={orgNamePending}
                className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
              >
                {orgNamePending ? <ButtonSpinner /> : null}
                {orgNamePending ? "Saving…" : "Save organization name"}
              </button>
            </form>

            <div className="mt-8 border-t border-foreground/10 pt-6">
              {departmentsState && !departmentsState.ok ? (
                <div className="mb-2">
                  <FormAlert>{departmentsState.error}</FormAlert>
                </div>
              ) : null}
              {departmentsState?.ok ? (
                <p className="mb-2 text-xs text-[var(--success)]">Departments saved.</p>
              ) : null}
              <form action={departmentsAction} className="space-y-4">
                <OrgDepartmentsEditor
                  customDepartments={customDepartments}
                  onCustomDepartmentsChange={setCustomDepartments}
                />
                <button
                  type="submit"
                  disabled={departmentsPending}
                  aria-busy={departmentsPending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {departmentsPending ? <ButtonSpinner /> : null}
                  {departmentsPending ? "Saving…" : "Save departments"}
                </button>
              </form>
            </div>

            <div className="mt-8 border-t border-foreground/10 pt-6">
              <h3 className="text-sm font-semibold text-foreground">Brand & HR documents</h3>
              <p className="mt-1 text-xs text-muted">
                Logo, colors, and contact details appear on payslips, employee forms, and printable PDFs.
              </p>
              {brandState && !brandState.ok ? (
                <div className="mt-2">
                  <FormAlert>{brandState.error}</FormAlert>
                </div>
              ) : null}
              {brandState?.ok ? <p className="mt-2 text-xs text-[var(--success)]">Branding saved.</p> : null}
              <form action={brandAction} className="mt-4 space-y-4">
                <input type="hidden" name="logoUrl" value={logoUrl} />
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]">
                    {logoUploading ? "Uploading…" : "Upload logo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleLogoFileUpload(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="h-12 w-auto object-contain" />
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Primary color</label>
                    <input
                      name="primaryColor"
                      type="color"
                      defaultValue={branding.primaryColor}
                      className="h-10 w-full cursor-pointer rounded border border-foreground/15 bg-field"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Accent color</label>
                    <input
                      name="accentColor"
                      type="color"
                      defaultValue={branding.accentColor}
                      className="h-10 w-full cursor-pointer rounded border border-foreground/15 bg-field"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">HR / company email</label>
                    <input
                      name="orgEmail"
                      type="email"
                      defaultValue={branding.orgEmail ?? ""}
                      placeholder="hr@company.com"
                      className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Phone</label>
                    <input
                      name="orgPhone"
                      defaultValue={branding.orgPhone ?? ""}
                      className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-muted">Street address</label>
                    <input
                      name="orgAddressLine"
                      defaultValue={branding.orgAddressLine ?? ""}
                      className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
                    />
                  </div>
                  <GlobalLocationFields
                    countryName="orgCountry"
                    stateName="orgState"
                    cityName="orgCity"
                    defaultCountry={branding.orgCountry ?? "Nigeria"}
                    defaultState={branding.orgState}
                    defaultCity={branding.orgCity}
                    className="grid gap-3 sm:col-span-2 sm:grid-cols-3"
                  />
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">
                      Default payroll country code
                    </label>
                    <input
                      name="payrollCountryCode"
                      defaultValue={branding.payrollCountryCode}
                      maxLength={2}
                      autoCapitalize="characters"
                      className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm uppercase"
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      ISO code, for example NG, GH, GB, or US. Payroll runs only when a reviewed rule pack exists.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">
                      Employee Compensation / NSITF rate (%)
                    </label>
                    <input
                      name="nsitfRate"
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      defaultValue={branding.nsitfRate}
                      className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">ITF rate (%)</label>
                    <input
                      name="itfRate"
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      defaultValue={branding.itfRate}
                      className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      Keep at 0 unless the organization meets the applicable statutory threshold.
                    </p>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={brandPending}
                  aria-busy={brandPending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {brandPending ? <ButtonSpinner /> : null}
                  {brandPending ? "Saving…" : "Save branding"}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {tab === "modules" && canManageOrg ? (
          <div id="settings-panel-modules" role="tabpanel" aria-labelledby="settings-tab-modules">
            <h2 className="text-sm font-semibold text-foreground">Modules & access</h2>
            <p className="mt-2 text-xs text-muted">
              <strong className="font-medium text-foreground/90">Job roles</strong> are managed on{" "}
              <Link
                href={`/${tenantSlug}/team`}
                className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground/60"
              >
                Team
              </Link>
              . Module entitlements (what your organization has paid for) are controlled by Realcorp platform
              admin — contact support to add or change modules.
            </p>
            {modulesState && !modulesState.ok ? (
              <div className="mt-2">
                <FormAlert>{modulesState.error}</FormAlert>
              </div>
            ) : null}
            {modulesState?.ok ? (
              <p className="mt-2 text-xs text-[var(--success)]">Role access saved.</p>
            ) : null}

            <div className="mt-4 space-y-5">
              {TENANT_MODULE_GROUPS.map((group) => {
                const items = TENANT_MODULE_DEFINITIONS.filter((d) => d.group === group.id);
                if (items.length === 0) return null;
                return (
                  <section key={group.id}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{group.label}</p>
                    <ul className="mt-2 divide-y divide-foreground/10 rounded-lg border border-foreground/10 text-sm">
                      {items.map((def) => {
                        const on = modules[def.key as keyof typeof modules];
                        return (
                          <li
                            key={def.key}
                            className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{def.label}</p>
                              {def.description ? (
                                <p className="mt-0.5 text-xs text-muted">{def.description}</p>
                              ) : null}
                              {def.subpages.length > 0 ? (
                                <p className="mt-1 text-[11px] text-muted">
                                  Includes: {def.subpages.join(" · ")}
                                </p>
                              ) : null}
                            </div>
                            <span
                              className={[
                                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                                on
                                  ? "bg-[var(--success-wash)] text-[var(--success)] "
                                  : "bg-foreground/[0.06] text-muted",
                              ].join(" ")}
                            >
                              {on ? "Enabled" : "Not on plan"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>

            <form action={modulesAction} className="mt-6 space-y-6">
              <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
                <p className="text-sm font-semibold text-foreground">
                  {formatEnumLabel(MembershipRole.ORG_ADMIN)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Always has the full sidebar for every module enabled on your plan. No checkboxes needed.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Optional add-ons by role
                </p>
                <p className="mt-1 text-xs text-muted">
                  Grant extra sidebar areas beyond each role&apos;s defaults. Greyed out = that module is not
                  on your plan.
                </p>
                <RoleExtraAccessMatrix modules={modules} initialGrants={initialRoleGrants} />
              </div>

              <button
                type="submit"
                disabled={modulesPending}
                aria-busy={modulesPending}
                className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
              >
                {modulesPending ? <ButtonSpinner /> : null}
                {modulesPending ? "Saving…" : "Save role access"}
              </button>
            </form>
          </div>
        ) : null}

        {tab === "integrations" ? (
          <div id="settings-panel-integrations" role="tabpanel" aria-labelledby="settings-tab-integrations">
            <h2 className="text-sm font-semibold text-foreground">Integrations</h2>
            <p className="mt-1 text-xs text-muted">
              Connect external platforms to automatically capture and communicate with leads.
            </p>

            <form action={intAction} className="mt-5 space-y-6">
              <input type="hidden" name="logoUrl" value={logoUrl} />
              <div className="rounded-lg border border-foreground/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  {/* <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-wash)] text-xs font-bold text-[var(--accent)]">

 </span> */}
                  <span className="text-sm font-semibold text-foreground">Branding (Company Logo)</span>
                </div>
                <p className="mb-3 text-xs text-muted">
                  Upload your company logo once. It will be used in future report exports and printable
                  documents.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]">
                    {logoUploading ? "Uploading..." : "Upload logo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleLogoFileUpload(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                  >
                    Remove logo
                  </button>
                </div>
                {logoUploadError ? (
                  <div className="mt-2 rounded-md border border-[var(--danger-line)] bg-[var(--danger-wash)] px-3 py-2 text-xs text-[var(--danger)]">
                    {logoUploadError}
                  </div>
                ) : null}
                {logoUrl ? (
                  <div className="mt-3 rounded-md border border-foreground/10 bg-foreground/[0.02] p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Company logo preview" className="h-16 w-auto object-contain" />
                    {/* <p className="mt-2 text-[11px] text-muted break-all">{logoUrl}</p> */}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted">No logo uploaded yet.</p>
                )}
              </div>

              {/* Meta Lead Ads */}
              <div className="rounded-lg border border-foreground/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--info-wash)] text-xs font-bold text-[var(--info)]">
                    f
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    Meta Lead Ads (Facebook / Instagram)
                  </span>
                </div>
                <p className="mb-3 text-xs text-muted">
                  When a prospect fills your Facebook or Instagram lead form, they are automatically created
                  as a lead here.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Verify Token</label>
                    <input
                      name="metaVerifyToken"
                      defaultValue={integrations.metaVerifyToken ?? ""}
                      placeholder="e.g. my_secret_token_123"
                      className="w-full rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      Set this exact value in Meta → Webhook → Verify Token
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      Default source label
                    </label>
                    <input
                      name="metaDefaultSource"
                      defaultValue={integrations.metaDefaultSource ?? "Facebook"}
                      placeholder="Facebook"
                      className="w-full rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      Page Access Token
                    </label>
                    <input
                      name="metaPageAccessToken"
                      type="password"
                      defaultValue=""
                      placeholder={
                        integrations.metaPageAccessToken
                          ? "Saved — leave blank to keep"
                          : "EAA… (long-lived page token)"
                      }
                      className="w-full rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    />
                    <p className="mt-1 text-[11px] text-muted">
                      Used to fetch full lead field data from the Graph API. Keep this secret.
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded-md bg-foreground/[0.03] p-2.5 text-xs text-muted">
                  <strong className="text-foreground">Webhook URL:</strong>{" "}
                  <code className="select-all rounded bg-foreground/[0.05] px-1 py-0.5 font-mono">
                    {typeof window !== "undefined" ? window.location.origin : "https://yourapp.com"}
                    /api/webhooks/meta-leads/{tenantSlug}
                  </code>
                </div>
              </div>

              {/* Termii SMS */}
              <div className="rounded-lg border border-foreground/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--success-wash)] text-xs font-bold text-[var(--success)]">
                    SMS
                  </span>
                  <span className="text-sm font-semibold text-foreground">Termii SMS</span>
                </div>
                <p className="mb-3 text-xs text-muted">
                  Send automated SMS messages to leads from a branded sender ID.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">API Key</label>
                    <input
                      name="termiiApiKey"
                      type="password"
                      defaultValue=""
                      placeholder={
                        integrations.termiiApiKey ? "Saved — leave blank to keep" : "TL_xxxxxxxxxxxx"
                      }
                      className="w-full rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Sender ID</label>
                    <input
                      name="termiiSenderId"
                      defaultValue={integrations.termiiSenderId ?? "Realcorp"}
                      placeholder="Realcorp"
                      className="w-full rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/30"
                    />
                    <p className="mt-1 text-[11px] text-muted">Max 11 characters, pre-approved by Termii</p>
                  </div>
                </div>
              </div>

              {/* WhatsApp Cloud API */}
              {integrations.moduleWhatsApp === false ? (
                <div className="rounded-lg border border-dashed border-foreground/15 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-foreground/[0.06] text-xs font-bold text-muted">
                      WA
                    </span>
                    <span className="text-sm font-semibold text-foreground">WhatsApp CRM + Bot</span>
                  </div>
                  <p className="text-xs text-muted">
                    Not included in your current plan. Contact your platform administrator to enable the
                    WhatsApp inbox, follow-ups, and the auto-reply listings bot.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-foreground/10 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--success-wash)] text-xs font-bold text-[var(--success)]">
                      WA
                    </span>
                    <span className="text-sm font-semibold text-foreground">WhatsApp Cloud API (Meta)</span>
                  </div>
                  <p className="mb-3 text-xs text-muted">
                    Send WhatsApp follow-ups from the CRM and receive inbound replies via webhook.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">Access Token</label>
                      <input
                        name="whatsappAccessToken"
                        type="password"
                        defaultValue=""
                        placeholder={
                          integrations.whatsappAccessToken ? "Saved — leave blank to keep" : "EAAB..."
                        }
                        className="w-full rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/30"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Phone Number ID
                      </label>
                      <input
                        name="whatsappPhoneNumberId"
                        defaultValue={integrations.whatsappPhoneNumberId ?? ""}
                        placeholder="e.g. 123456789012345"
                        className="w-full rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/30"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-foreground">
                        Webhook Verify Token
                      </label>
                      <input
                        name="whatsappVerifyToken"
                        defaultValue={integrations.whatsappVerifyToken ?? ""}
                        placeholder="my_whatsapp_verify_token"
                        className="w-full rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/30"
                      />
                      <p className="mt-1 text-[11px] text-muted">Use this token in Meta webhook setup.</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-md bg-foreground/[0.03] p-2.5 text-xs text-muted">
                    <strong className="text-foreground">Webhook URL:</strong>{" "}
                    <code className="select-all rounded bg-foreground/[0.05] px-1 py-0.5 font-mono">
                      {typeof window !== "undefined" ? window.location.origin : "https://yourapp.com"}
                      /api/webhooks/whatsapp/{tenantSlug}
                    </code>
                  </div>
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-md border border-[var(--success-line)] bg-[var(--success)]/[0.04] px-3 py-2.5">
                    <input
                      type="checkbox"
                      name="whatsappBotEnabled"
                      defaultChecked={integrations.whatsappBotEnabled}
                      className="mt-0.5 h-4 w-4 accent-emerald-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">Enable Realcorp Bot</span>
                      <span className="block text-xs text-muted">
                        Auto-replies to inbound WhatsApp messages with a menu of your published listings,
                        books viewings, and creates leads + follow-up tasks for your team.
                      </span>
                    </span>
                  </label>
                  <WhatsAppTestSend tenantSlug={tenantSlug} />
                </div>
              )}

              <div className="rounded-lg border border-foreground/10 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-slate-600/10 text-xs font-bold text-slate-700">
                    ₦
                  </span>
                  <span className="text-sm font-semibold text-foreground">Finance form options</span>
                </div>
                <p className="text-xs text-muted">
                  Finance dropdown catalogs (bank/cash accounts, payment modes, currencies) are now managed in
                  a dedicated Finance Settings page with add/remove controls.
                </p>
                <div className="mt-3">
                  <Link
                    href={`/${tenantSlug}/finance/settings`}
                    className="inline-flex rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                  >
                    Open Finance Settings
                  </Link>
                </div>
              </div>

              {intState && !intState.ok && <FormAlert>{intState.error}</FormAlert>}
              {intState?.ok && (
                <p className="text-sm font-medium text-[var(--success)]">Integration settings saved.</p>
              )}
              <button
                type="submit"
                disabled={intPending}
                aria-busy={intPending}
                className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {intPending ? <ButtonSpinner /> : null}
                {intPending ? "Saving…" : "Save integration settings"}
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
  FACILITY: { title: "Facility", subtitle: "Stores, plant, damages" },
};

const ROLE_GRANT_ROW_HINT: Partial<Record<MembershipRole, string>> = {
  [MembershipRole.SALES_EXECUTIVE]: "Default: core CRM, Settings.",
  [MembershipRole.SALES_MANAGER]: "Default: core CRM, Settings.",
  [MembershipRole.FINANCE_MANAGER]: "Default: core CRM, Finance, Settings.",
  [MembershipRole.HR_MANAGER]: "Default: People (HR), Team, Settings.",
  [MembershipRole.MARKETING_MANAGER]:
    "Default: projects, leads, Marketing, Settings. Tick Sales to add Deals (full CRM strip).",
  [MembershipRole.COMMUNITY_MANAGER]: "Default: Community, Settings.",
  [MembershipRole.FACILITY_MANAGER]: "Default: Facility, Projects, Tasks, Settings.",
  [MembershipRole.FACILITY_STAFF]: "Default: Facility, Tasks, Settings.",
};

function orgModuleAllowsGrant(
  modules: {
    moduleSales: boolean;
    moduleMarketing: boolean;
    moduleCommunity: boolean;
    moduleFinance: boolean;
    moduleFacility: boolean;
  },
  token: ExtraModuleGrantToken,
): boolean {
  if (token === "SALES") return modules.moduleSales;
  if (token === "MARKETING") return modules.moduleMarketing;
  if (token === "COMMUNITY") return modules.moduleCommunity;
  if (token === "FACILITY") return modules.moduleFacility;
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
    moduleFacility: boolean;
  };
  initialGrants: Partial<Record<MembershipRole, ExtraModuleGrantToken[]>>;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-foreground/10">
      <table className="w-full min-w-[780px] text-left text-sm">
        <caption className="sr-only">
          Optional sidebar access: Sales, Marketing, Community, Finance, and Facility can be granted per role
          when org modules are on.
        </caption>
        <thead>
          <tr className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase tracking-wide">
            <th className="px-3 py-2 font-semibold text-muted">Role</th>
            {EXTRA_MODULE_GRANT_TOKENS.map((token) => {
              const on = orgModuleAllowsGrant(modules, token);
              const meta = EXTRA_COLUMN_META[token];
              return (
                <th
                  key={token}
                  className={[
                    "px-3 py-2 font-semibold normal-case",
                    on ? "text-foreground" : "text-muted",
                  ].join(" ")}
                >
                  <span className="block">{meta.title}</span>
                  <span className="mt-0.5 block text-[10px] font-normal normal-case text-muted">
                    {meta.subtitle}
                  </span>
                  {!on ? (
                    <span className="mt-1 block text-[10px] font-normal text-muted">Module off</span>
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {MEMBERSHIP_ROLES_FOR_GRANT_MATRIX.map((role) => (
            <tr key={role} className="border-b border-foreground/10 last:border-b-0">
              <td className="align-top px-3 py-3">
                <p className="font-medium text-foreground">{membershipRoleLabel(role)}</p>
                {ROLE_GRANT_ROW_HINT[role] ? (
                  <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-muted">
                    {ROLE_GRANT_ROW_HINT[role]}
                  </p>
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
                          ? `Allow ${membershipRoleLabel(role)} to open ${EXTRA_COLUMN_META[token].title}`
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
    <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
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

function WhatsAppTestSend({ tenantSlug }: { tenantSlug: string }) {
  const { showSnackbar } = useSnackbar();
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  async function runTest() {
    if (sending) return;
    const trimmed = phone.trim();
    if (!trimmed) {
      showSnackbar("Enter a phone number to send the test to.", "error");
      return;
    }
    setSending(true);
    try {
      const result = await sendWhatsAppTestMessage(tenantSlug, trimmed);
      if (result.ok) {
        showSnackbar("Test message sent. Check the phone's WhatsApp.", "success");
      } else {
        showSnackbar(result.error, "error");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-3 rounded-md border border-dashed border-foreground/15 p-2.5">
      <p className="mb-2 text-xs font-medium text-foreground">Test your setup</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runTest();
            }
          }}
          placeholder="Your WhatsApp number, e.g. 0803 123 4567"
          className="w-full rounded-md border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-foreground/30 sm:max-w-xs"
        />
        <button
          type="button"
          onClick={() => void runTest()}
          disabled={sending}
          aria-busy={sending}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-foreground/[0.06] disabled:opacity-60"
        >
          {sending ? <ButtonSpinner /> : null}
          {sending ? "Sending…" : "Send test message"}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-muted">
        Uses your saved credentials. Save the form first if you just changed them.
      </p>
    </div>
  );
}
