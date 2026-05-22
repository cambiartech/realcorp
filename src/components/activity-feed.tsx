"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ActivityStatus, ActivityType } from "@/generated/prisma";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { createActivity, deleteActivity, completeActivity } from "@/app/[tenantSlug]/activities/actions";

export type ActivityRow = {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  body: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdByUserId: string;
  assignedUserId: string | null;
  createdAt: string;
  actorLabel: string;
  assignedLabel: string | null;
};

type ActionResult = { ok: true } | { ok: false; error: string };
const initial: ActionResult | null = null;

const TYPE_ICONS: Record<ActivityType, string> = {
  NOTE: "📝",
  CALL: "📞",
  EMAIL: "✉️",
  WHATSAPP: "💬",
  MEETING: "🤝",
  TASK: "✅",
};

const TYPE_LABELS: Record<ActivityType, string> = {
  NOTE: "Note",
  CALL: "Call",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  MEETING: "Meeting",
  TASK: "Task",
};

const STATUS_STYLE: Record<ActivityStatus, string> = {
  DONE: "bg-green-500/10 text-green-700 border border-green-500/20",
  PENDING: "bg-amber-500/10 text-amber-700 border border-amber-500/20",
  OVERDUE: "bg-red-500/10 text-red-700 border border-red-500/20",
};

export function ActivityFeed({
  tenantSlug,
  entityType,
  entityId,
  initialActivities,
  users,
  currentUserId,
  canManage,
}: {
  tenantSlug: string;
  entityType: "LEAD" | "DEAL";
  entityId: string;
  initialActivities: ActivityRow[];
  users: { id: string; label: string }[];
  currentUserId: string;
  canManage: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [typeFilter, setTypeFilter] = useState<ActivityType | "ALL">("ALL");
  const [state, formAction, pending] = useActionState(createActivity.bind(null, tenantSlug), initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { showSnackbar } = useSnackbar();
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      showSnackbar("Activity logged.", "success");
      formRef.current?.reset();
      setIsAdding(false);
    } else {
      showSnackbar(state.error, "error");
    }
  }, [state, showSnackbar]);

  async function handleDelete(activityId: string) {
    setDeletingId(activityId);
    const result = await deleteActivity(tenantSlug, activityId);
    setDeletingId(null);
    if (!result.ok) showSnackbar(result.error, "error");
    else showSnackbar("Activity deleted.", "success");
  }

  async function handleComplete(activityId: string) {
    setCompletingId(activityId);
    const result = await completeActivity(tenantSlug, activityId);
    setCompletingId(null);
    if (!result.ok) showSnackbar(result.error, "error");
    else showSnackbar("Task marked done.", "success");
  }

  const displayed =
    typeFilter === "ALL"
      ? initialActivities
      : initialActivities.filter((a) => a.type === typeFilter);

  return (
    <div>
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setTypeFilter("ALL")}
            className={[
              "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
              typeFilter === "ALL"
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground",
            ].join(" ")}
          >
            All
          </button>
          {Object.values(ActivityType).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={[
                "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                typeFilter === t
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground",
              ].join(" ")}
            >
              {TYPE_ICONS[t]} {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIsAdding((v) => !v)}
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
        >
          {isAdding ? "Cancel" : "+ Log activity"}
        </button>
      </div>

      {/* Log form */}
      {isAdding ? (
        <div className="mb-4 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <form ref={formRef} action={formAction} className="space-y-3">
            {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}
            <input type="hidden" name="entityType" value={entityType} />
            <input type="hidden" name="entityId" value={entityId} />

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">Type</label>
                <UiSelect name="type" defaultValue={ActivityType.NOTE}>
                  {Object.values(ActivityType).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_ICONS[t]} {TYPE_LABELS[t]}
                    </option>
                  ))}
                </UiSelect>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted">Assign to</label>
                <UiSelect name="assignedUserId" defaultValue={currentUserId}>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </UiSelect>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">Title *</label>
              <input
                name="title"
                required
                placeholder="e.g. Called client — no answer. Will try again Friday."
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted">Notes (optional)</label>
              <textarea
                name="body"
                rows={2}
                placeholder="Additional context..."
                className="w-full resize-y border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted">Due date (tasks only)</label>
                <input
                  name="dueAt"
                  type="datetime-local"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving…" : "Log activity"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {/* Feed */}
      {displayed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-foreground/15 p-6 text-center text-sm text-muted">
          {typeFilter === "ALL"
            ? "No activities yet. Log a call, note, or task to get started."
            : `No ${TYPE_LABELS[typeFilter as ActivityType]} activities yet.`}
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((activity) => {
            const isOwner = activity.createdByUserId === currentUserId;
            const canDelete = isOwner || canManage;
            const isTask = activity.type === ActivityType.TASK;
            const isPending = activity.status === ActivityStatus.PENDING || activity.status === ActivityStatus.OVERDUE;

            return (
              <div
                key={activity.id}
                className="rounded-lg border border-foreground/10 bg-background px-4 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 text-base">{TYPE_ICONS[activity.type]}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{activity.title}</p>
                        {isTask ? (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[activity.status]}`}>
                            {activity.status}
                          </span>
                        ) : null}
                      </div>
                      {activity.body ? (
                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{activity.body}</p>
                      ) : null}
                      <p className="mt-1.5 text-xs text-muted">
                        {activity.actorLabel}
                        {activity.assignedLabel && activity.assignedLabel !== activity.actorLabel
                          ? ` · Assigned to ${activity.assignedLabel}`
                          : null}
                        {activity.dueAt ? ` · Due ${new Date(activity.dueAt).toLocaleDateString()}` : null}
                        {" · "}{new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isTask && isPending ? (
                      <button
                        type="button"
                        disabled={completingId === activity.id}
                        onClick={() => startTransition(() => { void handleComplete(activity.id); })}
                        className="text-[11px] text-green-700 underline decoration-green-400/50 underline-offset-2 disabled:opacity-50"
                      >
                        {completingId === activity.id ? "…" : "Done"}
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        type="button"
                        disabled={deletingId === activity.id}
                        onClick={() => startTransition(() => { void handleDelete(activity.id); })}
                        className="text-[11px] text-error underline decoration-error/40 underline-offset-2 disabled:opacity-50"
                      >
                        {deletingId === activity.id ? "…" : "Delete"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
