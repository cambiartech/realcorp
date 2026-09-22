"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { SearchableSelect } from "@/components/searchable-select";
import { TenantPageShell } from "@/components/tenant-page-shell";
import { PageHeader } from "@/components/page-header";
import { ButtonSpinner } from "@/components/button-spinner";
import { ModalOverlay } from "@/components/modal-overlay";
import {
  MODAL_PANEL_FORM,
  MODAL_PANEL_LG,
  MODAL_PANEL_MD,
  MODAL_PANEL_SM,
  MODAL_PANEL_XL,
  MODAL_PANEL_XS,
  MODAL_PANEL_2XL,
} from "@/lib/modal-panel";
import type { OrgDepartment } from "@/lib/org-membership-profile";
import {
  createWorkTask,
  createTaskSpace,
  deleteWorkTask,
  stopWorkTaskRecurrence,
  updateWorkTask,
  updateWorkTaskStatus,
} from "@/app/[tenantSlug]/tasks/actions";
import {
  isCompletedTaskOnActiveShelf,
  TASK_COMPLETED_SHELF_DAYS,
} from "@/lib/task-completed-shelf";
import { recurrenceFrequencyLabel } from "@/lib/work-task-recurrence";

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

export type WorkTaskRecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

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
  createdByUserId?: string | null;
  assigneeLabel: string;
  dueDateLabel: string | null;
  dueDateValue: string | null;
  completedAt?: string | null;
  completedAtLabel?: string | null;
  linkedEntityType: string | null;
  recurrenceFrequency: WorkTaskRecurrenceFrequency | null;
  recurrenceActive: boolean;
  recurrenceEndsAtValue: string | null;
  recurrenceMaxOccurrences: number | null;
};

export type MemberOption = { id: string; label: string };

const DEPT_SPACE_SLUG: Partial<Record<OrgDepartment, string>> = {
  hr: "people",
  marketing: "product",
  operations: "engineering",
  community: "people",
};

const DEPT_TASK_LABEL: Record<OrgDepartment, string> = {
  sales: "Sales task",
  finance: "Finance task",
  marketing: "Marketing task",
  community: "Community task",
  hr: "People (HR) task",
  operations: "Operations task",
  facility: "Facility task",
};

function defaultSpaceIdForDepartment(spaces: TaskSpaceRow[], department: OrgDepartment | null | undefined) {
  const slug = department ? DEPT_SPACE_SLUG[department] : undefined;
  if (slug) {
    const match = spaces.find((s) => s.slug === slug);
    if (match) return match.id;
  }
  return spaces.find((s) => s.slug === "company-hq")?.id || spaces[0]?.id || "";
}

type ViewTab = "company" | "my" | "sprint" | "history";

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
  canViewAllOrgTasks = false,
  isDepartmentLead = false,
  initialView = "company",
  department = null,
  loadError = null,
}: {
  tenantSlug: string;
  currentUserId: string;
  spaces: TaskSpaceRow[];
  projects: TaskProjectRow[];
  tasks: WorkTaskRow[];
  members: MemberOption[];
  canManageSpaces: boolean;
  canViewAllOrgTasks?: boolean;
  isDepartmentLead?: boolean;
  initialView?: ViewTab;
  department?: OrgDepartment | null;
  loadError?: string | null;
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
  const preferredSpaceId = defaultSpaceIdForDepartment(spaces, department);
  const [createSpaceId, setCreateSpaceId] = useState(preferredSpaceId);
  const [createRecurrenceFrequency, setCreateRecurrenceFrequency] = useState<"" | WorkTaskRecurrenceFrequency>("");
  const [createRecurrenceEndMode, setCreateRecurrenceEndMode] = useState<"NEVER" | "UNTIL_DATE" | "AFTER_COUNT">(
    "NEVER",
  );
  const [editRecurrenceFrequency, setEditRecurrenceFrequency] = useState<"" | WorkTaskRecurrenceFrequency>("");
  const [editRecurrenceEndMode, setEditRecurrenceEndMode] = useState<"NEVER" | "UNTIL_DATE" | "AFTER_COUNT">(
    "NEVER",
  );
  const [taskToDelete, setTaskToDelete] = useState<WorkTaskRow | null>(null);
  const [deleteScope, setDeleteScope] = useState<"THIS" | "SERIES">("THIS");
  const [editingTask, setEditingTask] = useState<WorkTaskRow | null>(null);
  const [editSpaceId, setEditSpaceId] = useState(spaces[0]?.id || "");

  function openCreateModal() {
    setCreateSpaceId(preferredSpaceId);
    setCreateRecurrenceFrequency("");
    setCreateRecurrenceEndMode("NEVER");
    setIsCreateOpen(true);
  }

  const filteredTasks = useMemo(() => {
    let rows = tasks.filter((t) => t.status !== "CANCELLED");
    if (viewTab === "history") {
      rows = rows.filter((t) => t.status === "DONE");
    } else {
      if (viewTab === "my") rows = rows.filter((t) => t.assigneeUserId === currentUserId);
      if (viewTab === "sprint") rows = rows.filter((t) => Boolean(t.sprintLabel));
      // Keep Done column tidy: older completions live in Completed history.
      rows = rows.filter((t) => isCompletedTaskOnActiveShelf(t));
    }
    if (spaceFilter !== "all") rows = rows.filter((t) => t.spaceId === spaceFilter);
    if (assigneeFilter === "unassigned") rows = rows.filter((t) => !t.assigneeUserId);
    else if (assigneeFilter === "me") rows = rows.filter((t) => t.assigneeUserId === currentUserId);
    else if (assigneeFilter !== "all") rows = rows.filter((t) => t.assigneeUserId === assigneeFilter);
    if (viewTab !== "history" && statusFilter !== "all") {
      rows = rows.filter((t) => t.status === statusFilter);
    }
    if (priorityFilter !== "all") rows = rows.filter((t) => t.priority === priorityFilter);
    if (projectFilter !== "all") rows = rows.filter((t) => t.projectId === projectFilter);
    if (viewTab === "history") {
      rows = [...rows].sort((a, b) => {
        const aMs = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const bMs = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return bMs - aMs;
      });
    }
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
      const frequencyRaw = String(formData.get("recurrenceFrequency") || "");
      const endModeRaw = String(formData.get("recurrenceEndMode") || "NEVER") as
        | "NEVER"
        | "UNTIL_DATE"
        | "AFTER_COUNT";
      const maxRaw = String(formData.get("recurrenceMaxOccurrences") || "").trim();
      const result = await createWorkTask(tenantSlug, {
        title: String(formData.get("title") || ""),
        description: String(formData.get("description") || "") || undefined,
        spaceId: String(formData.get("spaceId") || "") || undefined,
        projectId: String(formData.get("projectId") || "") || undefined,
        assigneeUserId: String(formData.get("assigneeUserId") || "") || undefined,
        dueDate: String(formData.get("dueDate") || "") || undefined,
        sprintLabel: String(formData.get("sprintLabel") || "") || undefined,
        priority: (String(formData.get("priority") || "MEDIUM") as WorkTaskRow["priority"]) || "MEDIUM",
        recurrenceFrequency: frequencyRaw
          ? (frequencyRaw as WorkTaskRecurrenceFrequency)
          : null,
        recurrenceEndMode: frequencyRaw ? endModeRaw : undefined,
        recurrenceEndsAt: String(formData.get("recurrenceEndsAt") || "") || undefined,
        recurrenceMaxOccurrences: maxRaw ? Number(maxRaw) : null,
      });
      if (!result.ok) {
        showSnackbar(result.error, "error");
        return;
      }
      showSnackbar(
        frequencyRaw ? "Recurring task created." : "Task created.",
        "success",
      );
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
      if (status === "DONE") {
        showSnackbar("Task completed. Next occurrence created if it repeats.", "success");
      } else if (status === "CANCELLED") {
        showSnackbar("Task cancelled. Repeating series stopped if it was active.", "success");
      }
      router.refresh();
    });
  }

  function handleDeleteRequest(task: WorkTaskRow) {
    setDeleteScope(task.recurrenceActive && task.recurrenceFrequency ? "SERIES" : "THIS");
    setTaskToDelete(task);
  }

  function handleDeleteConfirm() {
    if (!taskToDelete) return;
    const taskId = taskToDelete.id;
    const scope = deleteScope;
    startTransition(async () => {
      const result = await deleteWorkTask(tenantSlug, taskId, scope);
      if (!result.ok) {
        showSnackbar(result.error, "error");
        return;
      }
      showSnackbar(
        scope === "SERIES" ? "Task removed and series ended." : "Task deleted.",
        "success",
      );
      setTaskToDelete(null);
      router.refresh();
    });
  }

  function openEditTask(task: WorkTaskRow) {
    setEditSpaceId(task.spaceId || spaces[0]?.id || "");
    setEditRecurrenceFrequency(task.recurrenceFrequency || "");
    setEditRecurrenceEndMode(
      task.recurrenceMaxOccurrences
        ? "AFTER_COUNT"
        : task.recurrenceEndsAtValue
          ? "UNTIL_DATE"
          : "NEVER",
    );
    setEditingTask(task);
  }

  async function handleEdit(formData: FormData) {
    if (!editingTask) return;
    startTransition(async () => {
      const frequencyRaw = String(formData.get("recurrenceFrequency") || "");
      const endModeRaw = String(formData.get("recurrenceEndMode") || "NEVER") as
        | "NEVER"
        | "UNTIL_DATE"
        | "AFTER_COUNT";
      const maxRaw = String(formData.get("recurrenceMaxOccurrences") || "").trim();
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
        recurrenceFrequency: frequencyRaw
          ? (frequencyRaw as WorkTaskRecurrenceFrequency)
          : null,
        recurrenceEndMode: frequencyRaw ? endModeRaw : "NEVER",
        recurrenceEndsAt: String(formData.get("recurrenceEndsAt") || "") || undefined,
        recurrenceMaxOccurrences: maxRaw ? Number(maxRaw) : null,
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

  function handleStopRecurrence() {
    if (!editingTask) return;
    startTransition(async () => {
      const result = await stopWorkTaskRecurrence(tenantSlug, editingTask.id);
      if (!result.ok) {
        showSnackbar(result.error, "error");
        return;
      }
      showSnackbar("Stopped repeating. This task stays open as a one-off.", "success");
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
      <PageHeader
        eyebrow="Work"
        title="Tasks"
        description="Company work across teams — boards, sprints, and assignments. CRM follow-ups stay under Sales → Activities."
        actions={
          <button type="button" onClick={openCreateModal} className="rc-btn rc-btn-primary">
            New task
          </button>
        }
      />

      {loadError ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-wash)] px-4 py-3 text-sm text-[var(--warn)]"
        >
          {loadError}
        </div>
      ) : null}

      <div className="rc-tabs" role="tablist">
        {(
          [
            {
              id: "company" as const,
              label: canViewAllOrgTasks
                ? "Company tasks"
                : isDepartmentLead
                  ? "Team tasks"
                  : "Assigned & created",
            },
            { id: "my" as const, label: "My tasks" },
            { id: "sprint" as const, label: "Current sprint" },
            { id: "history" as const, label: "Completed history" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={viewTab === tab.id}
            data-active={viewTab === tab.id}
            onClick={() => setViewTab(tab.id)}
            className="rc-tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="rc-toolbar">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-[11px] font-medium text-muted">
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
          <label className="mb-1 block text-[11px] font-medium text-muted">
            Status
          </label>
          <UiSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm"
            disabled={viewTab === "history"}
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
          <label className="mb-1 block text-[11px] font-medium text-muted">
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
          <label className="mb-1 block text-[11px] font-medium text-muted">
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
          <label className="mb-1 block text-[11px] font-medium text-muted">
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
        {viewTab === "history"
          ? `Showing ${filteredTasks.length} completed task${filteredTasks.length === 1 ? "" : "s"} — useful for appraisals and performance reviews.`
          : `Showing ${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"}${activeFilterCount > 0 ? " matching filters" : ""}. Done items leave the board after ${TASK_COMPLETED_SHELF_DAYS} days (see Completed history).`}
      </p>

      {viewTab === "sprint" ? (
        <p className="mt-3 text-xs text-muted">
          Showing tasks tagged with a sprint label — demo sprint:{" "}
          <span className="font-medium text-foreground">{activeSprintLabel}</span>
        </p>
      ) : null}

      {viewTab === "history" ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-foreground/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Task</th>
                <th className="px-3 py-2.5 font-semibold">Assignee</th>
                <th className="px-3 py-2.5 font-semibold">Project</th>
                <th className="px-3 py-2.5 font-semibold">Priority</th>
                <th className="px-3 py-2.5 font-semibold">Completed</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-xs text-muted">
                    No completed tasks yet.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-foreground/[0.06] last:border-0 hover:bg-foreground/[0.02]"
                  >
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => openEditTask(task)}
                        className="text-left font-medium text-foreground hover:underline"
                      >
                        {task.title}
                      </button>
                      {task.spaceName ? (
                        <p className="mt-0.5 text-[11px] text-muted">{task.spaceName}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{task.assigneeLabel}</td>
                    <td className="px-3 py-2.5 text-muted">
                      {task.projectName
                        ? `${task.projectEmoji ? `${task.projectEmoji} ` : ""}${task.projectName}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={[
                          "rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          PRIORITY_STYLE[task.priority],
                        ].join(" ")}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-muted">
                      {task.completedAtLabel || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
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
                        {task.recurrenceFrequency && task.recurrenceActive ? (
                          <span className="rounded-full border border-foreground/20 bg-foreground/[0.04] px-1.5 py-0.5 text-[10px] font-semibold text-foreground">
                            {recurrenceFrequencyLabel(task.recurrenceFrequency)}
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
                  setCreateRecurrenceFrequency("");
                  setCreateRecurrenceEndMode("NEVER");
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
      )}

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
          {taskToDelete.recurrenceFrequency && taskToDelete.recurrenceActive ? (
            <fieldset className="mt-4 space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted">
                Recurring series
              </legend>
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="deleteScope"
                  className="mt-1"
                  checked={deleteScope === "THIS"}
                  onChange={() => setDeleteScope("THIS")}
                />
                <span>
                  This task only
                  <span className="mt-0.5 block text-xs text-muted">
                    Removes this card. Completing it would have created the next one — that stops.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="radio"
                  name="deleteScope"
                  className="mt-1"
                  checked={deleteScope === "SERIES"}
                  onChange={() => setDeleteScope("SERIES")}
                />
                <span>
                  Stop and remove this task (end series)
                  <span className="mt-0.5 block text-xs text-muted">
                    Ends the repeat. Past completed occurrences stay in history.
                  </span>
                </span>
              </label>
            </fieldset>
          ) : null}
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
        <ModalOverlay open onClose={() => setEditingTask(null)} panelClassName={MODAL_PANEL_FORM}>
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
                <SearchableSelect
                  name="projectId"
                  defaultValue={editingTask.projectId || ""}
                  allowEmpty
                  emptyLabel="None"
                  searchPlaceholder="Search projects…"
                  options={projectsForEditSpace.map((p) => ({
                    value: p.id,
                    label: `${p.iconEmoji ? `${p.iconEmoji} ` : ""}${p.name}`,
                  }))}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Assignee</label>
              <SearchableSelect
                name="assigneeUserId"
                defaultValue={editingTask.assigneeUserId || ""}
                allowEmpty
                emptyLabel="Unassigned"
                searchPlaceholder="Search people…"
                options={members.map((m) => ({ value: m.id, label: m.label }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted">Due date</label>
                <input
                  name="dueDate"
                  type="date"
                  required={Boolean(editRecurrenceFrequency)}
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-muted">Repeat</label>
                <UiSelect
                  name="recurrenceFrequency"
                  value={editRecurrenceFrequency}
                  onChange={(e) =>
                    setEditRecurrenceFrequency((e.target.value || "") as "" | WorkTaskRecurrenceFrequency)
                  }
                >
                  <option value="">Does not repeat</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </UiSelect>
              </div>
              {editRecurrenceFrequency ? (
                <div>
                  <label className="mb-1 block text-sm text-muted">Ends</label>
                  <UiSelect
                    name="recurrenceEndMode"
                    value={editRecurrenceEndMode}
                    onChange={(e) =>
                      setEditRecurrenceEndMode(
                        e.target.value as "NEVER" | "UNTIL_DATE" | "AFTER_COUNT",
                      )
                    }
                  >
                    <option value="NEVER">Never (keep going)</option>
                    <option value="UNTIL_DATE">On a date</option>
                    <option value="AFTER_COUNT">After a number of times</option>
                  </UiSelect>
                </div>
              ) : (
                <div />
              )}
            </div>
            {editRecurrenceFrequency && editRecurrenceEndMode === "UNTIL_DATE" ? (
              <div>
                <label className="mb-1 block text-sm text-muted">End date</label>
                <input
                  name="recurrenceEndsAt"
                  type="date"
                  required
                  defaultValue={editingTask.recurrenceEndsAtValue || ""}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
                />
              </div>
            ) : null}
            {editRecurrenceFrequency && editRecurrenceEndMode === "AFTER_COUNT" ? (
              <div>
                <label className="mb-1 block text-sm text-muted">Number of times</label>
                <input
                  name="recurrenceMaxOccurrences"
                  type="number"
                  min={1}
                  max={999}
                  required
                  defaultValue={editingTask.recurrenceMaxOccurrences ?? 12}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
                />
              </div>
            ) : null}
            {editRecurrenceFrequency ? (
              <p className="text-xs text-muted">
                Completing this card creates the next occurrence with the next due date. Cancel stops the
                series.
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {editingTask.recurrenceActive && editingTask.recurrenceFrequency ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleStopRecurrence}
                  className="mr-auto rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
                >
                  Stop repeating
                </button>
              ) : null}
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
        panelClassName={MODAL_PANEL_FORM}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {department ? DEPT_TASK_LABEL[department] : "New task"}
            </h2>
            {department ? (
              <p className="mt-0.5 text-xs text-muted">
                Defaults to your department teamspace — adjust assignee and due date below.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form action={handleCreate} className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted">Title</label>
            <input
              name="title"
              required
              className="w-full border border-foreground/15 bg-field px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Description (optional)</label>
            <textarea
              name="description"
              rows={4}
              className="w-full border border-foreground/15 bg-field px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
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
              <SearchableSelect
                key={createSpaceId || "no-create-space"}
                name="projectId"
                defaultValue=""
                allowEmpty
                emptyLabel="None"
                searchPlaceholder="Search projects…"
                options={projectsForSpace.map((p) => ({
                  value: p.id,
                  label: `${p.iconEmoji ? `${p.iconEmoji} ` : ""}${p.name}`,
                }))}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Assignee</label>
              <SearchableSelect
                name="assigneeUserId"
                defaultValue={currentUserId}
                allowEmpty
                emptyLabel="Unassigned"
                searchPlaceholder="Search people…"
                options={members.map((m) => ({ value: m.id, label: m.label }))}
              />
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
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Due date</label>
              <input
                name="dueDate"
                type="date"
                required={Boolean(createRecurrenceFrequency)}
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
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Repeat</label>
              <UiSelect
                name="recurrenceFrequency"
                value={createRecurrenceFrequency}
                onChange={(e) =>
                  setCreateRecurrenceFrequency((e.target.value || "") as "" | WorkTaskRecurrenceFrequency)
                }
              >
                <option value="">Does not repeat</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </UiSelect>
            </div>
            {createRecurrenceFrequency ? (
              <div>
                <label className="mb-1 block text-sm text-muted">Ends</label>
                <UiSelect
                  name="recurrenceEndMode"
                  value={createRecurrenceEndMode}
                  onChange={(e) =>
                    setCreateRecurrenceEndMode(
                      e.target.value as "NEVER" | "UNTIL_DATE" | "AFTER_COUNT",
                    )
                  }
                >
                  <option value="NEVER">Never (keep going)</option>
                  <option value="UNTIL_DATE">On a date</option>
                  <option value="AFTER_COUNT">After a number of times</option>
                </UiSelect>
              </div>
            ) : (
              <div />
            )}
          </div>
          {createRecurrenceFrequency && createRecurrenceEndMode === "UNTIL_DATE" ? (
            <div>
              <label className="mb-1 block text-sm text-muted">End date</label>
              <input
                name="recurrenceEndsAt"
                type="date"
                required
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
              />
            </div>
          ) : null}
          {createRecurrenceFrequency && createRecurrenceEndMode === "AFTER_COUNT" ? (
            <div>
              <label className="mb-1 block text-sm text-muted">Number of times</label>
              <input
                name="recurrenceMaxOccurrences"
                type="number"
                min={1}
                max={999}
                required
                defaultValue={12}
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
              />
            </div>
          ) : null}
          {createRecurrenceFrequency ? (
            <p className="text-xs text-muted">
              Only the current card stays on the board. Mark it complete to spawn the next one — safe for
              long-running daily/weekly routines.
            </p>
          ) : null}
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
