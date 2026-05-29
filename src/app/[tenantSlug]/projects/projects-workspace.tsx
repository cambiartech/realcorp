"use client";

import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG, MODAL_PANEL_MD, MODAL_PANEL_SM, MODAL_PANEL_XL, MODAL_PANEL_XS, MODAL_PANEL_2XL } from "@/lib/modal-panel";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormAlert, FormFieldError } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { ButtonSpinner } from "@/components/button-spinner";
import { CurrencySelect } from "@/components/finance/currency-select";
import { getEntityTimelineLogs } from "../finance/actions";
import { createProject, deleteProject, updateProject } from "./actions";

type ProjectRow = {
  id: string;
  name: string;
  unitsCount: number;
  createdAt: string;
  basePrice: number | null;
  currency: string;
};

type ActionResult = { ok: true } | { ok: false; error: string };
type TimelineLogRow = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  summary: string;
};
type ActiveFilterChip = { label: string; clearHref: string };

const initial: ActionResult | null = null;

export function ProjectsWorkspace({
  tenantSlug,
  projects,
  canManage,
  activeFilterChips,
  currencies,
  defaultCurrency,
}: {
  tenantSlug: string;
  projects: ProjectRow[];
  canManage: boolean;
  activeFilterChips?: ActiveFilterChip[];
  currencies: string[];
  defaultCurrency: string;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRow | null>(null);
  const [deletingProject, setDeletingProject] = useState<ProjectRow | null>(null);
  const [timelineProject, setTimelineProject] = useState<ProjectRow | null>(null);
  const [timelineLogs, setTimelineLogs] = useState<TimelineLogRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [state, formAction, pending] = useActionState(createProject.bind(null, tenantSlug), initial);
  const [editState, editAction, editPending] = useActionState(
    updateProject.bind(null, tenantSlug, editingProject?.id ?? ""),
    initial,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteProject.bind(null, tenantSlug, deletingProject?.id ?? ""),
    initial,
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const { showSnackbar } = useSnackbar();
  const formRef = useRef<HTMLFormElement | null>(null);
  const editFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      showSnackbar("Project created successfully.", "success");
      formRef.current?.reset();
      queueMicrotask(() => {
        setIsCreateOpen(false);
        setNameError(null);
      });
    } else {
      showSnackbar(state.error, "error");
    }
  }, [showSnackbar, state]);

  useEffect(() => {
    if (!editState) return;
    if (editState.ok) {
      showSnackbar("Project updated successfully.", "success");
      queueMicrotask(() => {
        setEditingProject(null);
        setEditNameError(null);
      });
    } else {
      showSnackbar(editState.error, "error");
    }
  }, [editState, showSnackbar]);

  useEffect(() => {
    if (!deleteState) return;
    if (deleteState.ok) {
      showSnackbar("Project deleted successfully.", "success");
      queueMicrotask(() => setDeletingProject(null));
    } else {
      showSnackbar(deleteState.error, "error");
    }
  }, [deleteState, showSnackbar]);

  function submitCreateProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const rawName = String(formData.get("name") ?? "").trim();
    if (!rawName) {
      setNameError("Project name is required.");
      return;
    }
    setNameError(null);
    formAction(formData);
  }

  function submitEditProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const rawName = String(formData.get("name") ?? "").trim();
    if (!rawName) {
      setEditNameError("Project name is required.");
      return;
    }
    setEditNameError(null);
    editAction(formData);
  }

  async function openTimeline(project: ProjectRow) {
    setTimelineProject(project);
    setTimelineLoading(true);
    const result = await getEntityTimelineLogs(tenantSlug, "PROJECT", project.id);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setTimelineLogs([]);
      setTimelineLoading(false);
      return;
    }
    setTimelineLogs(result.logs);
    setTimelineLoading(false);
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted">Create projects and drill into units inventory.</p>
          {activeFilterChips && activeFilterChips.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <Link
                  key={chip.label}
                  href={chip.clearHref}
                  className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
                  title={`Remove ${chip.label}`}
                >
                  <span>{chip.label}</span>
                  <span aria-hidden>×</span>
                </Link>
              ))}
              <Link
                href={`/${tenantSlug}/projects`}
                className="text-xs font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2"
              >
                Clear filters
              </Link>
            </div>
          ) : null}
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            New project
          </button>
        ) : null}
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Base price</th>
              <th className="px-4 py-3">Units</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-sm text-muted">
                  No projects yet.
                </td>
              </tr>
            ) : (
              projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{project.name}</td>
                  <td className="px-4 py-3 text-muted">
                    {project.basePrice != null ? `${project.currency} ${project.basePrice.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">{project.unitsCount}</td>
                  <td className="px-4 py-3 text-muted">{project.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/${tenantSlug}/projects/${project.id}`}
                        className="text-sm font-medium text-foreground underline decoration-foreground/20 underline-offset-2"
                      >
                        Open units
                      </Link>
                      <button
                        type="button"
                        onClick={() => openTimeline(project)}
                        className="text-xs text-muted underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
                      >
                        Timeline
                      </button>
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingProject(project)}
                            className="text-xs text-muted underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProject(project)}
                            className="text-xs text-error underline decoration-error/40 underline-offset-2"
                          >
                            Delete
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ModalOverlay open={Boolean(isCreateOpen)} onClose={() => setIsCreateOpen(false)} panelClassName={MODAL_PANEL_SM}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Create project</h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <form ref={formRef} noValidate onSubmit={submitCreateProject} className="mt-4 space-y-4">
              {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}
              <div>
                <label htmlFor="project-name" className="mb-1 block text-sm text-muted">
                  Project name
                </label>
                <input
                  id="project-name"
                  name="name"
                  placeholder="e.g. BO Gardens Phase 1"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
                {nameError ? <FormFieldError>{nameError}</FormFieldError> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="project-base-price" className="mb-1 block text-sm text-muted">
                    Base price (optional)
                  </label>
                  <input
                    id="project-base-price"
                    name="basePrice"
                    inputMode="decimal"
                    placeholder="e.g. 70000000"
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="project-currency" className="mb-1 block text-sm text-muted">
                    Currency
                  </label>
                  <CurrencySelect
                    id="project-currency"
                    currencies={currencies}
                    defaultCurrency={defaultCurrency}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  aria-busy={pending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? <ButtonSpinner /> : null}
                  {pending ? "Creating project..." : "Create project"}
                </button>
              </div>
            </form>
      </ModalOverlay>

      {editingProject ? (
        <ModalOverlay open onClose={() => setEditingProject(null)} panelClassName={MODAL_PANEL_SM}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Edit project</h2>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form ref={editFormRef} noValidate onSubmit={submitEditProject} className="mt-4 space-y-4">
              {editState && !editState.ok ? <FormAlert>{editState.error}</FormAlert> : null}
              <div>
                <label htmlFor="project-edit-name" className="mb-1 block text-sm text-muted">
                  Project name
                </label>
                <input
                  id="project-edit-name"
                  name="name"
                  defaultValue={editingProject.name}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
                {editNameError ? <FormFieldError>{editNameError}</FormFieldError> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="project-edit-base-price" className="mb-1 block text-sm text-muted">
                    Base price (optional)
                  </label>
                  <input
                    id="project-edit-base-price"
                    name="basePrice"
                    inputMode="decimal"
                    defaultValue={editingProject.basePrice != null ? String(editingProject.basePrice) : ""}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="project-edit-currency" className="mb-1 block text-sm text-muted">
                    Currency
                  </label>
                  <CurrencySelect
                    id="project-edit-currency"
                    currencies={currencies}
                    defaultCurrency={defaultCurrency}
                    defaultValue={editingProject.currency}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPending}
                  aria-busy={editPending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {editPending ? <ButtonSpinner /> : null}
                  {editPending ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
        </ModalOverlay>
      ) : null}

      {deletingProject ? (
        <ModalOverlay open onClose={() => setDeletingProject(null)} panelClassName={MODAL_PANEL_SM}>
            <h2 className="text-lg font-semibold text-foreground">Delete project?</h2>
            <p className="mt-2 text-sm text-muted">
              This will remove <strong className="text-foreground">{deletingProject.name}</strong> only if it has no
              units.
            </p>
            {deleteState && !deleteState.ok ? <FormAlert>{deleteState.error}</FormAlert> : null}
            <form action={deleteAction} className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingProject(null)}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={deletePending}
                aria-busy={deletePending}
                className="inline-flex items-center gap-2 rounded-md border border-error bg-error px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deletePending ? <ButtonSpinner /> : null}
                {deletePending ? "Deleting..." : "Delete"}
              </button>
            </form>
        </ModalOverlay>
      ) : null}

      {timelineProject ? (
        <ModalOverlay
          open
          onClose={() => setTimelineProject(null)}
          variant="drawer"
          panelClassName="h-full w-full max-w-md shrink-0 overflow-y-auto border-l border-foreground/10 bg-background p-4 shadow-2xl"
        >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Project Timeline</h2>
                <p className="text-xs text-muted">{timelineProject.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setTimelineProject(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close timeline"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {timelineLoading ? (
              <p className="mt-4 text-sm text-muted">Loading timeline...</p>
            ) : timelineLogs.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No timeline events yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {timelineLogs.map((log) => (
                  <li key={log.id} className="rounded-md border border-foreground/10 p-3">
                    <p className="text-xs text-muted">{log.timestamp}</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{log.action}</p>
                    <p className="text-xs text-muted">By: {log.actor}</p>
                    <p className="mt-1 text-sm text-foreground/90">{log.summary}</p>
                  </li>
                ))}
              </ul>
            )}
        </ModalOverlay>
      ) : null}
    </div>
  );
}
