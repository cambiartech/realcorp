"use client";

import { useState } from "react";

export function TagsInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Type an option and press Enter",
  hint,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const [draft, setDraft] = useState("");

  function addFromDraft() {
    const parts = draft
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    for (const part of parts) {
      if (!next.some((t) => t.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    onChange(next);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div>
      {value.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.06] px-2.5 py-1 text-sm text-foreground"
            >
              {tag}
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded-full px-0.5 text-muted hover:bg-foreground/10 hover:text-foreground"
                  aria-label={`Remove ${tag}`}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        !disabled ? <p className="mb-2 text-xs text-muted">No options yet — add one below.</p> : null
      )}
      {!disabled ? (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addFromDraft();
                } else if (e.key === "Backspace" && !draft && value.length > 0) {
                  onChange(value.slice(0, -1));
                }
              }}
              onBlur={() => addFromDraft()}
              placeholder={placeholder}
              className="min-w-0 flex-1 border border-foreground/15 bg-field px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addFromDraft}
              disabled={!draft.trim()}
              className="shrink-0 rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold hover:bg-foreground/[0.04] disabled:opacity-40"
            >
              Add
            </button>
          </div>
          {hint ? <p className="mt-1 text-[11px] text-muted">{hint}</p> : null}
        </>
      ) : null}
    </div>
  );
}
