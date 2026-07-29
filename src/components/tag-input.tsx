"use client";

import { useState } from "react";

type Props = {
  name: string;
  initialTags?: string[];
  placeholder?: string;
  maxTags?: number;
  className?: string;
};

const FIELD_CLASS =
  "min-h-[42px] w-full flex flex-wrap items-center gap-1.5 rounded-md border border-foreground/15 bg-field px-2 py-1.5 focus-within:ring-2 focus-within:ring-foreground/20";

export function TagInput({
  name,
  initialTags = [],
  placeholder = "Type and press Enter",
  maxTags = 20,
  className,
}: Props) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");

  function addTag(raw: string) {
    const parts = raw
      .split(/[,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setTags((prev) => {
      const next = [...prev];
      for (const part of parts) {
        if (next.length >= maxTags) break;
        if (!next.some((t) => t.toLowerCase() === part.toLowerCase())) {
          next.push(part);
        }
      }
      return next;
    });
    setInput("");
  }

  function removeTag(index: number) {
    setTags((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className={className}>
      <div className={FIELD_CLASS}>
        {tags.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-md border border-foreground/15 bg-background px-2 py-0.5 text-xs text-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-muted hover:text-foreground"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(input);
            } else if (e.key === "Backspace" && !input && tags.length > 0) {
              removeTag(tags.length - 1);
            }
          }}
          onBlur={() => {
            if (input.trim()) addTag(input);
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-foreground outline-none placeholder:text-muted"
        />
      </div>
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
      <p className="mt-1 text-[11px] text-muted">
        Press Enter to add each amenity. Backspace removes the last tag.
      </p>
    </div>
  );
}
