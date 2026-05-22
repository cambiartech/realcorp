"use client";

import { useState } from "react";
import { HR_FIELD_CLASS } from "@/components/hr/hr-form-field";

function parseTags(value: string | undefined) {
  if (!value?.trim()) return [];
  return value
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function HrTagsInput({
  label,
  name,
  defaultValue,
  required,
  placeholder = "Type and press Enter",
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const [tags, setTags] = useState(() => parseTags(defaultValue));
  const [draft, setDraft] = useState("");

  function addFromDraft() {
    const parts = draft
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setTags((prev) => {
      const next = [...prev];
      for (const p of parts) {
        if (!next.some((t) => t.toLowerCase() === p.toLowerCase())) next.push(p);
      }
      return next;
    });
    setDraft("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  return (
    <div className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <input type="hidden" name={name} value={tags.join(", ")} required={required && tags.length === 0} />
      {tags.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-sm text-slate-800"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-full px-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addFromDraft();
          } else if (e.key === "Backspace" && !draft && tags.length > 0) {
            setTags((prev) => prev.slice(0, -1));
          }
        }}
        onBlur={() => addFromDraft()}
        placeholder={placeholder}
        className={HR_FIELD_CLASS}
      />
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}
