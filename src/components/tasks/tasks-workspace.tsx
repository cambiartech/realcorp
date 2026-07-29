"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { TenantPageShell } from "@/components/tenant-page-shell";
import { ButtonSpinner } from "@/components/button-spinner";
import { ModalOverlay } from "@/components/modal-overlay";
import {
  MODAL_PANEL_LG,
  MODAL_PANEL_MD,
  MODAL_PANEL_SM,
  MODAL_PANEL_XL,
  MODAL_PANEL_XS,
  MODAL_PANEL_2XL,
} from "@/lib/modal-panel";
import {
  createWorkTask,
  createTaskSpace,
  deleteWorkTask,
  updateWorkTask,
  updateWorkTaskStatus,
} from "@/app/[tenantSlug]/tasks/actions";

export type TaskSpaceRow = {
  id: string;
  name: string;
  slug: string;
  color: string;
};

export type TaskProjectRow = {
  id: string;
  name: string;
  spaceId: string;
  sprintLabel: string | null;
  iconEmoji: string | null;
};

export type WorkTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  spaceId: string | null;
  spaceName: string | null;
  spaceColor: string | null;
  projectId: string | null;
  projectName: string | null;
  projectEmoji: string | null;
  sprintLabel: string | null;
  assigneeUserId: string | null;
  assigneeLabel: string;
  dueDateLabel: string | null;
  dueDateValue: string | null;
  linkedEntityType: string | null;
};

export type MemberOption = { id: string; label: string };

type ViewTab = "company" | "my" | "sprint";

const STATUS_COLUMNS: Array<{
  id: WorkTaskRow["status"];
  label: string;
  dot: string;
  headerBg: string;
  headerText: string;
}> = [
  {
    id: "TODO",
    label: "To-do",
    dot: "bg-[var(--accent)]",
    headerBg: "bg-[var(--accent-wash)] ",
    headerText: "text-[var(--accent)] ",
  },
  {
    id: "IN_PROGRESS",
    label: "In progress",
    dot: "bg-[var(--warn)]",
    headerBg: "bg-[var(--warn-wash)] ",
    headerText: "text-[var(--warn)] ",
  },
  {
    id: "IN_REVIEW",
    label: "In review",
    dot: "bg-[var(--info)]",
    headerBg: "bg-[var(--info-wash)] ",
    headerText: "text-[var(--info)] ",
  },
  {
    id: "DONE",
    label: "Complete",
    dot: "bg-[var(--success)]",
    headerBg: "bg-[var(--success-wash)] ",
    headerText: "text-[var(--success)] ",
  },
];

const PRIORITY_STYLE: Record<WorkTaskRow["priority"], string> = {
  LOW: "border-foreground/15 text-muted",
  MEDIUM: "border-[var(--info-line)] text-[var(--info)] ",
  HIGH: "border-[var(--warn-line)] text-[var(--warn)] ",
  URGENT: "border-[var(--danger-line)] text-[var(--danger)] ",
};

function initials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function TasksWorkspace({
  tenantSlug,
  currentUserId,
  spaces,
  projects,
  tasks,
  members,
  canManageSpaces,
  initialView = "company",
}: {
  tenantSlug: string;
  currentUserId: string;
  spaces: TaskSpaceRow[];
  projects: TaskProjectRow[];
  tasks: WorkTaskRow[];
  members: MemberOption[];
  canManageSpaces: boolean;
  initialView?: ViewTab;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [viewTab, setViewTab] = useState<ViewTab>(initialView);
  const [spaceFilter, setSpaceFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateSpaceOpen, setIsCreateSpaceOpen] = useState(false);
  const [createSpaceId, setCreateSpaceId] = useState(spaces[0]?.id || "");
  const [taskToDelete, setTaskToDelete] = useState<WorkTaskRow | null>(null);
  const [editingTask, setEditingTask] = useState<WorkTaskRow | null>(null);
  const [editSpaceId, setEditSpaceId] = useState(spaces[0]?.id || "");

  const filteredTasks = useMemo(() => {
    let rows = tasks.filter((t) => t.status !== "CANCELLED");
    if (viewTab === "my") rows = rows.filter((t) => t.assigneeUserId === currentUserId);
    if (viewTab === "sprint") rows = rows.filter((t) => Boolean(t.sprintLabel));
    if (spaceFilter !== "all") rows = rows.filter((t) => t.spaceId === spaceFilter);
    if (assigneeFilter === "unassigned") rows = rows.filter((t) => !t.assigneeUserId);
    else if (assigneeFilter === "me") rows = rows.filter((t) => t.assigneeUserId === currentUserId);
    else if (assigneeFilter !== "all") rows = rows.filter((t) => t.assigneeUserId === assigneeFilter);
    if (statusFilter !== "all") rows = rows.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "all") rows = rows.filter((t) => t.priority === priorityFilter);
    if (projectFilter !== "all") rows = rows.filter((t) => t.projectId === projectFilter);
    return rows;
  }, [
    tasks,
    viewTab,
    spaceFilter,
    assigneeFilter,
    statusFilter,
    priorityFilter,
    projectFilter,
    currentUserId,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (spaceFilter !== "all") count += 1;
    if (assigneeFilter !== "all") count += 1;
    if (statusFilter !== "all") count += 1;
    if (priorityFilter !== "all") count += 1;
    if (projectFilter !== "all") count += 1;
    return count;
  }, [spaceFilter, assigneeFilter, statusFilter, priorityFilter, projectFilter]);

  const visibleColumns = useMemo(() => {
    if (statusFilter === "all") return STATUS_COLUMNS;
    return STATUS_COLUMNS.filter((col) => col.id === statusFilter);
  }, [statusFilter]);

  function clearFilters() {
    setSpaceFilter("all");
    setAssigneeFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setProjectFilter("all");
  }

  const tasksByStatus = useMemo(() => {
    const map = new Map<WorkTaskRow["status"], WorkTaskRow[]>();
    for (const col of STATUS_COLUMNS) map.set(col.id, []);
    for (const task of filteredTasks) {
      const bucket = map.get(task.status);
      if (bucket) bucket.push(task);
    }
    return map;
  }, [filteredTasks]);

  const activeSprintLabel = useMemo(() => {
    const labels = tasks.map((t) => t.sprintLabel).filter(Boolean) as string[];
    return labels[0] || "Sprint 12";
  }, [tasks]);

  async function handleCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createWorkTask(tenantSlug, {
        title: String(formData.get("title") || ""),
        description: String(formData.get("description") || "") || undefined,
        spaceId: String(formData.get("spaceId") || "") || undefined,
        projectId: String(formData.get("projectId") || "") || undefined,
        assigneeUserId: String(formData.get("assigneeUserId") || "") || undefined,
        dueDate: String(formData.get("dueDate") || "") || undefined,
        sprintLabel: String(formData.get("sprintLabel") || "") || undefined,
        priority: (String(formData.get("priority") || "MEDIUM") as WorkTaskRow["priority"]) || "MEDIUM",
      });
      if (!result.ok) {
        showSnackbar(result.error, "error");
        return;
      }
      showSnackbar("Task created.", "success");
      setIsCreateOpen(false);
      router.refresh();
    });
  }

  function handleStatusChange(taskId: string, status: WorkTaskRow["status"]) {
    startTransition(async () => {
      const result = await updateWorkTaskStatus(tenantSlug, taskId, status);
      if (!result.ok) {
        showSnackbar(result.error, "error");
        return;
      }
      router.refresh();
    });
  }

  function handleDeleteRequest(task: WorkTaskRow) {
    setTaskToDelete(task);
  }

  function handleDeleteConfirm() {
    if (!taskToDelete) return;
    const taskId = taskToDelete.id;
    startTransition(async () => {
      const result = await deleteWorkTask(tenantSlug, taskId);
      if (!result.ok) {
        showSnackbar(result.error, "error");
        return;
      }
      showSnackbar("Task deleted.", "success");
      setTaskToDelete(null);
      router.refresh();
    });
  }

  function openEditTask(task: WorkTaskRow) {
    setEditSpaceId(task.spaceId || spaces[0]?.id || "");
    setEditingTask(task);
  }

  async function handleEdit(formData: FormData) {
    if (!editingTask) return;
    startTransition(async () => {
      const result = await updateWorkTask(tenantSlug, {
        taskId: editingTask.id,
        title: String(formData.get("title") || ""),
        description: String(formData.get("description") || "") || undefined,
        status: String(formData.get("status") || editingTask.status) as WorkTaskRow["status"],
        spaceId: String(formData.get("spaceId") || "") || undefined,
        projectId: String(formData.get("projectId") || "") || undefined,
        assigneeUserId: String(formData.get("assigneeUserId") || "") || undefined,
        dueDate: String(formData.get("dueDate") || "") || undefined,
        sprintLabel: String(formData.get("sprintLabel") || "") || undefined,
        priority: (String(formData.get("priority") || "MEDIUM") as WorkTaskRow["priority"]) || "MEDIUM",
      });
      if (!result.ok) {
        showSnackbar(result.error, "error");
        return;
      }
      showSnackbar("Task updated.", "success");
      setEditingTask(null);
      router.refresh();
    });
  }

  async function handleCreateSpace(formData: FormData) {
    startTransition(async () => {
      const result = await createTaskSpace(tenantSlug, {
        name: String(formData.get("name") || ""),
        color: String(formData.get("color") || "#6366f1"),
      });
      if (!result.ok) {
        showSnackbar(result.error, "error");
        return;
      }
      showSnackbar("Teamspace added.", "success");
      setIsCreateSpaceOpen(false);
      if (result.spaceId) setSpaceFilter(result.spaceId);
      router.refresh();
    });
  }

  const projectsForSpace = projects.filter((p) => !createSpaceId || p.spaceId === createSpaceId);
  const projectsForEditSpace = projects.filter((p) => !editSpaceId || p.spaceId === editSpaceId);

  return (
    <TenantPageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Company work across teams — boards, sprints, and assignments. CRM follow-ups stay under Sales →
            Activities.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          New task
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-b border-foreground/10 pb-3">
        {(
          [
            { id: "company" as const, label: "Company tasks" },
            { id: "my" as const, label: "My tasks" },
            { id: "sprint" as const, label: "Current sprint" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setViewTab(tab.id)}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              viewTab === tab.id
                ? "bg-foreground text-background"
                : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">
            Assignee
          </label>
          <UiSelect
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="text-sm"
          >
            <option value="all">All assignees</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </UiSelect>
        </div>
        <div className="min-w-[120px] flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">
            Status
          </label>
          <UiSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm"
          >
            <option value="all">All statuses</option>
            {STATUS_COLUMNS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </UiSelect>
        </div>
        <div className="min-w-[120px] flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">
            Priority
          </label>
          <UiSelect
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-sm"
          >
            <option value="all">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </UiSelect>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">
            Teamspace
          </label>
          <UiSelect value={spaceFilter} onChange={(e) => setSpaceFilter(e.target.value)} className="text-sm">
            <option value="all">All teamspaces</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </UiSelect>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted">
            Project
          </label>
          <UiSelect
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-sm"
          >
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.iconEmoji ? `${p.iconEmoji} ` : ""}
                {p.name}
              </option>
            ))}
          </UiSelect>
        </div>
        {activeFilterCount > 0 ? (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-medium text-muted hover:bg-foreground/[0.06] hover:text-foreground"
          >
            Clear filters ({activeFilterCount})
          </button>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-muted">
        Showing {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"}
        {activeFilterCount > 0 ? " matching filters" : ""}
      </p>

      {viewTab === "sprint" ? (
        <p className="mt-3 text-xs text-muted">
          Showing tasks tagged with a sprint label — demo sprint:{" "}
          <span className="font-medium text-foreground">{activeSprintLabel}</span>
        </p>
      ) : null}

      <div
        className={`mt-4 grid gap-3 overflow-x-auto pb-4 ${visibleColumns.length === 1 ? "max-w-sm" : visibleColumns.length === 2 ? "lg:grid-cols-2" : visibleColumns.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
      >
        {visibleColumns.map((col) => {
          const colTasks = tasksByStatus.get(col.id) || [];
          return (
            <section
              key={col.id}
              className="flex min-w-[240px] flex-col rounded-lg border border-foreground/10 bg-foreground/[0.02]"
            >
              <header
                className={["flex items-center gap-2 rounded-t-lg px-3 py-2.5", col.headerBg].join(" ")}
              >
                <span className={["h-2 w-2 rounded-full", col.dot].join(" ")} aria-hidden />
                <h2 className={["text-sm font-semibold", col.headerText].join(" ")}>{col.label}</h2>
                <span className={["ml-auto text-xs font-medium", col.headerText].join(" ")}>
                  {colTasks.length}
                </span>
              </header>
              <ul className="flex flex-1 flex-col gap-2 p-2">
                {colTasks.length === 0 ? (
                  <li className="rounded-md border border-dashed border-foreground/10 px-3 py-6 text-center text-xs text-muted">
                    No tasks
                  </li>
                ) : (
                  colTasks.map((task) => (
                    <li
                      key={task.id}
                      className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-3 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => openEditTask(task)}
                          className="text-left text-sm font-semibold leading-snug text-foreground hover:underline"
                        >
                          {task.title}
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => openEditTask(task)}
                            className="rounded px-1 text-[10px] font-medium text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                            aria-label="Edit task"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleDeleteRequest(task)}
                            className="rounded px-1 text-[10px] text-muted hover:bg-error/10 hover:text-error"
                            aria-label="Delete task"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      {task.projectName ? (
                        <p className="mt-1 text-[11px] text-muted">
                          {task.projectEmoji ? `${task.projectEmoji} ` : ""}
                          {task.projectName}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {task.spaceName ? (
                          <span
                            className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{
                              borderColor: `${task.spaceColor || "#6366f1"}55`,
                              color: task.spaceColor || undefined,
                            }}
                          >
                            {task.spaceName}
                          </span>
                        ) : null}
                        {task.sprintLabel ? (
                          <span className="rounded-full border border-[var(--info-line)] bg-[var(--info-wash)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--info)]">
                            {task.sprintLabel}
                          </span>
                        ) : null}
                        <span
                          className={[
                            "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                            PRIORITY_STYLE[task.priority],
                          ].join(" ")}
                        >
                          {task.priority}
                        </span>
                        {task.linkedEntityType === "HR_APPRAISAL" ? (
                          <span className="rounded-full border border-pink-300/40 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700 dark:text-pink-300">
                            Appraisal
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/10 text-[10px] font-bold text-foreground"
                            title={task.assigneeLabel}
                          >
                            {initials(task.assigneeLabel)}
                          </span>
                          <span className="max-w-[90px] truncate text-[11px] text-muted">
                            {task.assigneeLabel}
                          </span>
                        </div>
                        {task.dueDateLabel ? (
                          <span className="text-[10px] text-muted">{task.dueDateLabel}</span>
                        ) : null}
                      </div>
                      <div className="mt-2">
                        <UiSelect
                          value={task.status}
                          disabled={pending}
                          onChange={(e) =>
                            handleStatusChange(task.id, e.target.value as WorkTaskRow["status"])
                          }
                          className="text-xs"
                        >
                          {STATUS_COLUMNS.map((s) => (
                            <option key={s.id} value={s.id}>
                              Move to {s.label}
                            </option>
                          ))}
                          <option value="CANCELLED">Cancel task</option>
                        </UiSelect>
                      </div>
                    </li>
                  ))
                )}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setCreateSpaceId(spaceFilter !== "all" ? spaceFilter : spaces[0]?.id || "");
                  setIsCreateOpen(true);
                }}
                className="m-2 rounded-md border border-dashed border-foreground/15 px-2 py-1.5 text-xs text-muted hover:border-foreground/30 hover:text-foreground"
              >
                + New task
              </button>
            </section>
          );
        })}
      </div>

      <section className="mt-6 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Teamspaces</h3>
            <p className="mt-1 text-xs text-muted">
              Namespaces for departments or teams — Marketing, Finance, People, etc. Tasks can be tagged to a
              teamspace.
            </p>
          </div>
          {canManageSpaces ? (
            <button
              type="button"
              onClick={() => setIsCreateSpaceOpen(true)}
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
            >
              + Add teamspace
            </button>
          ) : null}
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {spaces.map((space) => (
            <li key={space.id}>
              <button
                type="button"
                onClick={() => {
                  setSpaceFilter(space.id);
                  setViewTab("company");
                }}
                className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-foreground/[0.04]"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: space.color }} />
                {space.name}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {taskToDelete ? (
        <ModalOverlay open onClose={() => setTaskToDelete(null)} panelClassName={MODAL_PANEL_XS}>
          <h2 className="text-lg font-semibold text-foreground">Delete task?</h2>
          <p className="mt-2 text-sm text-muted">
            <span className="font-medium text-foreground">&ldquo;{taskToDelete.title}&rdquo;</span> will be
            removed permanently. This cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setTaskToDelete(null)}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={handleDeleteConfirm}
              aria-busy={pending}
              className="inline-flex items-center gap-2 rounded-md border border-error bg-error px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? <ButtonSpinner /> : null}
              {pending ? "Deleting…" : "Delete task"}
            </button>
          </div>
        </ModalOverlay>
      ) : null}

      {editingTask ? (
        <ModalOverlay open onClose={() => setEditingTask(null)} panelClassName={MODAL_PANEL_SM}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Edit task</h2>
            <button
              type="button"
              onClick={() => setEditingTask(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <form action={handleEdit} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm text-muted">Title</label>
              <input
                name="title"
                required
                defaultValue={editingTask.title}
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Description (optional)</label>
              <textarea
                name="description"
                rows={3}
                defaultValue={editingTask.description || ""}
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted">Status</label>
                <UiSelect name="status" defaultValue={editingTask.status}>
                  {STATUS_COLUMNS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                  <option value="CANCELLED">Cancelled</option>
                </UiSelect>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Priority</label>
                <UiSelect name="priority" defaultValue={editingTask.priority}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </UiSelect>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted">Teamspace</label>
                <UiSelect name="spaceId" value={editSpaceId} onChange={(e) => setEditSpaceId(e.target.value)}>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </UiSelect>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Project (optional)</label>
                <UiSelect name="projectId" defaultValue={editingTask.projectId || ""}>
                  <option value="">None</option>
                  {projectsForEditSpace.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.iconEmoji ? `${p.iconEmoji} ` : ""}
                      {p.name}
                    </option>
                  ))}
                </UiSelect>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Assignee</label>
              <UiSelect name="assigneeUserId" defaultValue={editingTask.assigneeUserId || ""}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </UiSelect>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted">Due date</label>
                <input
                  name="dueDate"
                  type="date"
                  defaultValue={editingTask.dueDateValue || ""}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Sprint label</label>
                <input
                  name="sprintLabel"
                  placeholder="Sprint 12"
                  defaultValue={editingTask.sprintLabel || ""}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
              >
                {pending ? <ButtonSpinner /> : null}
                {pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </ModalOverlay>
      ) : null}

      <ModalOverlay
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        panelClassName={MODAL_PANEL_SM}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">New task</h2>
          <button
            type="button"
            onClick={() => setIsCreateOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form action={handleCreate} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-muted">Title</label>
            <input
              name="title"
              required
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Description (optional)</label>
            <textarea
              name="description"
              rows={3}
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Teamspace</label>
              <UiSelect
                name="spaceId"
                value={createSpaceId}
                onChange={(e) => setCreateSpaceId(e.target.value)}
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </UiSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Project (optional)</label>
              <UiSelect name="projectId" defaultValue="">
                <option value="">None</option>
                {projectsForSpace.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.iconEmoji ? `${p.iconEmoji} ` : ""}
                    {p.name}
                  </option>
                ))}
              </UiSelect>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Assignee</label>
              <UiSelect name="assigneeUserId" defaultValue={currentUserId}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </UiSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Priority</label>
              <UiSelect name="priority" defaultValue="MEDIUM">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </UiSelect>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Due date</label>
              <input
                name="dueDate"
                type="date"
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Sprint label</label>
              <input
                name="sprintLabel"
                placeholder="Sprint 12"
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
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
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {pending ? <ButtonSpinner /> : null}
              {pending ? "Saving…" : "Create task"}
            </button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay
        open={isCreateSpaceOpen}
        onClose={() => setIsCreateSpaceOpen(false)}
        panelClassName={MODAL_PANEL_XS}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Add teamspace</h2>
          <button
            type="button"
            onClick={() => setIsCreateSpaceOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          e.g. Marketing, Finance, Legal — use this like a department or Notion teamspace.
        </p>
        <form action={handleCreateSpace} className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-sm text-muted">Name</label>
            <input
              name="name"
              required
              placeholder="Marketing"
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Color</label>
            <input
              name="color"
              type="color"
              defaultValue="#6366f1"
              className="h-10 w-full cursor-pointer rounded-md border border-foreground/15 bg-field"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateSpaceOpen(false)}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {pending ? <ButtonSpinner /> : null}
              {pending ? "Saving…" : "Add teamspace"}
            </button>
          </div>
        </form>
      </ModalOverlay>
    </TenantPageShell>
  );
}
