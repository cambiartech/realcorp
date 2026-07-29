"use client";

import { useState, useTransition } from "react";
import { MembershipRole } from "@/generated/prisma";
import { ModalOverlay } from "@/components/modal-overlay";
import { ButtonSpinner } from "@/components/button-spinner";
import { UiSelect } from "@/components/ui-select";
import { MODAL_PANEL_LG } from "@/lib/modal-panel";
import {
  MEMBERSHIP_MODULE_ACCESS_OPTIONS,
  type AssignableMemberModule,
  type MembershipModuleAccessLevel,
  type MembershipModulePermissions,
} from "@/lib/membership-module-permissions";
import { saveMembershipModulePermissions } from "./actions";

type Props = {
  tenantSlug: string;
  memberId: string;
  memberName: string;
  memberRole: MembershipRole;
  entitledModules: AssignableMemberModule[];
  initialPermissions: MembershipModulePermissions;
  onClose: () => void;
  onSaved: () => void;
};

export function MemberModuleAccessModal({
  tenantSlug,
  memberId,
  memberName,
  memberRole,
  entitledModules,
  initialPermissions,
  onClose,
  onSaved,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, "" | MembershipModuleAccessLevel>>(() => {
    const init: Record<string, "" | MembershipModuleAccessLevel> = {};
    for (const mod of entitledModules) {
      init[mod.key] = initialPermissions[mod.key] ?? "";
    }
    return init;
  });

  if (memberRole === MembershipRole.ORG_ADMIN) {
    return (
      <ModalOverlay open onClose={onClose} panelClassName={MODAL_PANEL_LG}>
        <h2 className="text-lg font-semibold text-foreground">Module access</h2>
        <p className="mt-2 text-sm text-muted">
          Organization admins always have full access to every module on your plan.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Close
          </button>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ModalOverlay open onClose={onClose} panelClassName={MODAL_PANEL_LG}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Module access</h2>
          <p className="mt-1 text-sm text-muted">{memberName}</p>
          <p className="mt-0.5 text-xs text-muted">
            Overrides apply on top of job role — only modules on your plan are listed.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {entitledModules.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          No modules are enabled on this organization&apos;s plan yet.
        </p>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData();
            for (const mod of entitledModules) {
              const v = values[mod.key] ?? "";
              if (v) fd.set(`perm_${mod.key}`, v);
            }
            startTransition(async () => {
              const res = await saveMembershipModulePermissions(tenantSlug, memberId, fd);
              if (res.ok) {
                onSaved();
                onClose();
              } else {
                setError(res.error);
              }
            });
          }}
        >
          <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10">
            {entitledModules.map((mod) => (
              <li key={mod.key} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{mod.label}</p>
                  <p className="text-xs text-muted">{mod.description}</p>
                </div>
                <UiSelect
                  className="min-w-[200px] text-sm"
                  value={values[mod.key] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [mod.key]: e.target.value as "" | MembershipModuleAccessLevel,
                    }))
                  }
                  disabled={pending}
                >
                  {MEMBERSHIP_MODULE_ACCESS_OPTIONS.map((opt) => (
                    <option key={opt.value || "inherit"} value={opt.value} title={opt.hint}>
                      {opt.label}
                    </option>
                  ))}
                </UiSelect>
              </li>
            ))}
          </ul>

          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {pending ? <ButtonSpinner /> : null}
              {pending ? "Saving…" : "Save module access"}
            </button>
          </div>
        </form>
      )}
    </ModalOverlay>
  );
}
