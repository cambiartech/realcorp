"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { syncOrgPensionAdministrators } from "@/app/[tenantSlug]/hr/actions";
import { useSnackbar } from "@/components/snackbar";
import {
  SUGGESTED_NIGERIA_PENSION_ADMINISTRATORS,
  normalizePensionAdministratorName,
} from "@/lib/org-pension-administrators";

type Props = {
  tenantSlug: string;
  administrators: string[];
  onChange: (next: string[]) => void;
  compact?: boolean;
};

export function PensionAdministratorsEditor({ tenantSlug, administrators, onChange, compact = false }: Props) {
  const { showSnackbar } = useSnackbar();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  async function persist(next: string[], successMessage: string) {
    setSaving(true);
    const result = await syncOrgPensionAdministrators(tenantSlug, next);
    setSaving(false);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return false;
    }
    onChange(next);
    showSnackbar(successMessage, "success");
    return true;
  }

  function alreadyListed(name: string, except?: string) {
    return administrators.some(
      (item) => item !== except && item.toLowerCase() === name.toLowerCase(),
    );
  }

  async function addName(raw: string) {
    const next = normalizePensionAdministratorName(raw);
    if (!next) return;
    if (alreadyListed(next)) {
      setNewName("");
      return;
    }
    const ok = await persist([...administrators, next], `${next} added. It now shows on People records.`);
    if (ok) setNewName("");
  }

  function startEdit(name: string) {
    setEditing(name);
    setDraft(name);
    setEditError("");
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
    setEditError("");
  }

  async function commitEdit() {
    if (!editing) return;
    const next = normalizePensionAdministratorName(draft);
    if (!next) {
      setEditError("Enter a pension administrator name.");
      return;
    }
    if (alreadyListed(next, editing)) {
      setEditError("That administrator is already on this list.");
      return;
    }
    const ok = await persist(
      administrators.map((item) => (item === editing ? next : item)),
      "Pension administrator renamed.",
    );
    if (ok) cancelEdit();
  }

  const unusedSuggestions = SUGGESTED_NIGERIA_PENSION_ADMINISTRATORS.filter(
    (name) => !alreadyListed(name),
  );

  return (
    <div id="org-pension-administrators" className="scroll-mt-6">
      {compact ? null : (
        <>
          <h3 className="text-sm font-semibold text-foreground">Pension fund administrators</h3>
          <p className="mt-1 text-xs text-muted">
            Each organization keeps its own PFA list. Add the administrators this company remits to — they
            appear on People records, onboarding, and My HR. Saved as soon as you add them.
          </p>
        </>
      )}
      {compact ? (
        <p className="text-xs font-medium text-foreground">Pension fund administrators (PFA)</p>
      ) : null}

      {unusedSuggestions.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-muted">Suggested — click to add to this organization</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unusedSuggestions.map((name) => (
              <button
                key={name}
                type="button"
                disabled={saving}
                onClick={() => void addName(name)}
                className="rounded-full border border-dashed border-foreground/25 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
              >
                + {name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex max-w-lg items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addName(newName);
            }
          }}
          placeholder="Add a PFA name"
          disabled={saving}
          className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
        />
        <button
          type="button"
          onClick={() => void addName(newName)}
          disabled={saving}
          className="shrink-0 rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add"}
        </button>
      </div>

      <div className="mt-2 flex max-w-lg flex-wrap gap-2">
        {administrators.length === 0 ? (
          <span className="text-[11px] text-muted">No PFAs on this organization yet.</span>
        ) : (
          administrators.map((name) =>
            editing === name ? (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full border border-foreground/30 bg-background px-2 py-1"
              >
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setEditError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitEdit();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  className="w-56 rounded border border-foreground/15 bg-field px-2 py-0.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
                  aria-label={`Rename ${name}`}
                />
                <button
                  type="button"
                  onClick={() => void commitEdit()}
                  className="rounded px-1.5 text-[10px] font-semibold text-foreground hover:bg-foreground/[0.08]"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded px-1 text-[10px] text-muted hover:bg-foreground/[0.08] hover:text-foreground"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full border border-foreground/20 px-2.5 py-1 text-[11px] font-medium text-foreground"
              >
                {name}
                <button
                  type="button"
                  aria-label={`Rename ${name}`}
                  title="Rename"
                  onClick={() => startEdit(name)}
                  className="rounded p-0.5 text-muted hover:bg-foreground/[0.08] hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  title="Remove"
                  onClick={() => void persist(administrators.filter((item) => item !== name), `${name} removed.`)}
                  className="rounded p-0.5 text-muted hover:bg-foreground/[0.08] hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ),
          )
        )}
      </div>
      {editError ? <p className="mt-1 text-[11px] text-[var(--danger)]">{editError}</p> : null}
    </div>
  );
}
