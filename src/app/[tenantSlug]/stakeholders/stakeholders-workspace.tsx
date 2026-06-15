"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Users, Building2, TrendingUp } from "lucide-react";
import { ModalOverlay } from "@/components/modal-overlay";
import { useSnackbar } from "@/components/snackbar";
import { AddStakeholderForm } from "@/components/stakeholders/add-stakeholder-form";
import { MODAL_PANEL_MD } from "@/lib/modal-panel";
import { removeProjectStakeholder } from "@/app/[tenantSlug]/projects/actions";

type ProjectRow = { id: string; name: string };

type StakeholderRow = {
  id: string;
  projectId: string;
  userId: string;
  type: "INVESTOR" | "LISTING_OWNER";
  investmentAmount: number | null;
  label: string;
  projectName: string;
};

type PortalMember = {
  userId: string;
  role: "INVESTOR" | "LISTING_OWNER";
  label: string;
};

const STAKE_TYPE_LABEL: Record<StakeholderRow["type"], string> = {
  INVESTOR: "Investor",
  LISTING_OWNER: "Listing owner",
};

function formatMoney(value: number) {
  return value.toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

export function StakeholdersWorkspace({
  tenantSlug,
  canManage,
  projects,
  stakeholders,
  portalMembers,
}: {
  tenantSlug: string;
  canManage: boolean;
  projects: ProjectRow[];
  stakeholders: StakeholderRow[];
  portalMembers: PortalMember[];
}) {
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState<"ALL" | StakeholderRow["type"]>("ALL");
  const [manageProject, setManageProject] = useState<ProjectRow | null>(null);

  const uniqueProjects = useMemo(
    () => [...new Map(projects.map((p) => [p.id, p])).values()].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stakeholders.filter((s) => {
      if (projectFilter !== "ALL" && s.projectId !== projectFilter) return false;
      if (roleFilter !== "ALL" && s.type !== roleFilter) return false;
      if (q) {
        const hay = [s.label, s.projectName, STAKE_TYPE_LABEL[s.type]].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [stakeholders, search, projectFilter, roleFilter]);

  const totalAllocation = stakeholders.reduce((sum, s) => sum + (s.investmentAmount ?? 0), 0);
  const investorCount = new Set(stakeholders.map((s) => s.userId)).size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Stakeholders</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Link investors and listing owners to projects. They track performance in the{" "}
            <Link href={`/${tenantSlug}/portal`} className="text-foreground underline underline-offset-2">
              investor portal
            </Link>
            .
          </p>
        </div>
        {canManage && uniqueProjects.length > 0 ? (
          <button
            type="button"
            onClick={() => setManageProject(uniqueProjects[0])}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
          >
            Add stakeholder
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatTile icon={Users} label="Stakeholders" value={String(investorCount)} />
        <StatTile icon={Building2} label="Project links" value={String(stakeholders.length)} />
        <StatTile
          icon={TrendingUp}
          label="Total allocation"
          value={totalAllocation > 0 ? formatMoney(totalAllocation) : "—"}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member or project…"
            className="w-full rounded-lg border border-foreground/15 bg-field py-2 pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
          />
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
        >
          <option value="ALL">All projects</option>
          {uniqueProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
          className="rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
        >
          <option value="ALL">All roles</option>
          <option value="INVESTOR">Investors</option>
          <option value="LISTING_OWNER">Listing owners</option>
        </select>
      </div>

      {stakeholders.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-foreground/15 px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">No stakeholders linked yet</p>
          <p className="mt-1 text-sm text-muted">
            Invite investors from Team, then assign them to a project with an allocation amount.
          </p>
          {canManage ? (
            <Link
              href={`/${tenantSlug}/team`}
              className="mt-4 inline-block text-sm font-medium text-foreground underline underline-offset-2"
            >
              Go to Team →
            </Link>
          ) : null}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-foreground/15 px-6 py-10 text-center text-sm text-muted">
          No matches for your filters. Try clearing search or filters.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-foreground/10 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.04] text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Project</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Allocation</th>
                {canManage ? <th className="px-4 py-3 font-medium text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/[0.06]">
              {filtered.map((stake) => (
                <tr key={stake.id} className="bg-background hover:bg-foreground/[0.02]">
                  <td className="px-4 py-3 font-medium text-foreground">{stake.label}</td>
                  <td className="px-4 py-3 text-muted">{stake.projectName}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-xs font-medium text-foreground">
                      {STAKE_TYPE_LABEL[stake.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {stake.investmentAmount != null ? `₦${formatMoney(stake.investmentAmount)}` : "—"}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setManageProject({ id: stake.projectId, name: stake.projectName })}
                        className="rounded-md border border-foreground/15 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-foreground/[0.06]"
                      >
                        Manage
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage && uniqueProjects.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">Quick add by project</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {uniqueProjects.map((project) => {
              const count = stakeholders.filter((s) => s.projectId === project.id).length;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setManageProject(project)}
                  className="rounded-full border border-foreground/15 bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:border-foreground/30 hover:bg-foreground/[0.04]"
                >
                  {project.name}
                  {count > 0 ? (
                    <span className="ml-1.5 text-xs text-muted">({count})</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {manageProject ? (
        <StakeholdersManageModal
          tenantSlug={tenantSlug}
          project={manageProject}
          stakeholders={stakeholders.filter((s) => s.projectId === manageProject.id)}
          portalMembers={portalMembers}
          onClose={() => setManageProject(null)}
        />
      ) : null}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3.5">
      <div className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function StakeholdersManageModal({
  tenantSlug,
  project,
  stakeholders,
  portalMembers,
  onClose,
}: {
  tenantSlug: string;
  project: ProjectRow;
  stakeholders: StakeholderRow[];
  portalMembers: PortalMember[];
  onClose: () => void;
}) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const { showSnackbar } = useSnackbar();

  async function handleRemove(stakeholderId: string) {
    setRemovingId(stakeholderId);
    const result = await removeProjectStakeholder(tenantSlug, stakeholderId);
    setRemovingId(null);
    if (result.ok) showSnackbar("Stakeholder removed.", "success");
    else showSnackbar(result.error, "error");
  }

  return (
    <ModalOverlay open onClose={onClose} panelClassName={MODAL_PANEL_MD}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Manage stakeholders</h2>
          <p className="text-sm text-muted">{project.name}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {stakeholders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-foreground/15 px-4 py-6 text-center text-sm text-muted">
            No stakeholders on this project yet.
          </p>
        ) : (
          stakeholders.map((stake) => (
            <div
              key={stake.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{stake.label}</p>
                <p className="text-xs text-muted">
                  {STAKE_TYPE_LABEL[stake.type]}
                  {stake.investmentAmount != null ? ` · ₦${formatMoney(stake.investmentAmount)} allocation` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={removingId === stake.id}
                onClick={() => handleRemove(stake.id)}
                className="rounded-md px-2 py-1 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-50"
              >
                {removingId === stake.id ? "Removing…" : "Remove"}
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 border-t border-foreground/10 pt-5">
        <AddStakeholderForm
          tenantSlug={tenantSlug}
          projectId={project.id}
          portalMembers={portalMembers}
          onSuccess={() => showSnackbar("Stakeholder saved.", "success")}
        />
      </div>
    </ModalOverlay>
  );
}
