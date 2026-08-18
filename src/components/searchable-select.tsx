"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type SearchableSelectOption = {
  value: string;
  label: string;
  group?: string;
  hint?: string;
  keywords?: string;
  disabled?: boolean;
};

export type SearchableSelectGroup = {
  label: string;
  options: SearchableSelectOption[];
};

function optionHaystack(option: SearchableSelectOption) {
  return `${option.label} ${option.hint ?? ""} ${option.keywords ?? ""} ${option.group ?? ""}`.toLowerCase();
}

function filterOptions(options: SearchableSelectOption[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  const parts = q.split(/\s+/).filter(Boolean);
  return options.filter((option) => {
    const text = optionHaystack(option);
    return parts.every((part) => text.includes(part));
  });
}

export function groupSearchableOptions(options: SearchableSelectOption[]): SearchableSelectGroup[] {
  const groups: SearchableSelectGroup[] = [];
  const index = new Map<string, SearchableSelectGroup>();
  for (const option of options) {
    const label = option.group?.trim() || "";
    if (!label) {
      const loose = index.get("") ?? { label: "", options: [] };
      if (!index.has("")) {
        index.set("", loose);
        groups.push(loose);
      }
      loose.options.push(option);
      continue;
    }
    const existing = index.get(label);
    if (existing) {
      existing.options.push(option);
      continue;
    }
    const next = { label, options: [option] };
    index.set(label, next);
    groups.push(next);
  }
  return groups;
}

export function SearchableSelect({
  name,
  id,
  value,
  defaultValue,
  onChange,
  options,
  groups,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  disabled,
  invalid,
  required,
  allowEmpty,
  emptyLabel = "None",
  className = "",
}: {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options?: SearchableSelectOption[];
  groups?: SearchableSelectGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const generatedId = useId();
  const listId = `${generatedId}-list`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [internal, setInternal] = useState(value ?? defaultValue ?? "");
  const selected = value ?? internal;
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );

  const allGroups = useMemo(() => {
    if (groups?.length) return groups;
    return groupSearchableOptions(options ?? []);
  }, [groups, options]);

  const visibleGroups = useMemo(() => {
    return allGroups
      .map((group) => ({ ...group, options: filterOptions(group.options, query) }))
      .filter((group) => group.options.length > 0);
  }, [allGroups, query]);

  const flatVisible = useMemo(
    () => visibleGroups.flatMap((group) => group.options.filter((option) => !option.disabled)),
    [visibleGroups],
  );
  const [activeValue, setActiveValue] = useState<string>("");

  const selectedOption = useMemo(() => {
    for (const group of allGroups) {
      const match = group.options.find((option) => option.value === selected);
      if (match) return match;
    }
    return null;
  }, [allGroups, selected]);

  useEffect(() => {
    if (value != null) setInternal(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const first = selected && flatVisible.some((option) => option.value === selected) ? selected : flatVisible[0]?.value ?? "";
    setActiveValue(first);
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, flatVisible, selected]);

  useEffect(() => {
    if (!open) return;
    function place() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const maxHeight = Math.min(320, Math.max(160, spaceBelow > 180 ? spaceBelow : spaceAbove));
      const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
      setMenuBox({
        top: openUp ? Math.max(8, rect.top - maxHeight - gap) : rect.bottom + gap,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: rect.width,
        maxHeight,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, query, visibleGroups.length]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target)) return;
      const menu = document.getElementById(listId);
      if (menu?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(false);
        setQuery("");
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, listId]);

  function commit(next: string) {
    setInternal(next);
    onChange?.(next);
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function moveActive(delta: number) {
    if (!flatVisible.length) return;
    const current = Math.max(0, flatVisible.findIndex((option) => option.value === activeValue));
    const next = (current + delta + flatVisible.length) % flatVisible.length;
    setActiveValue(flatVisible[next]?.value ?? "");
    const el = document.getElementById(`${listId}-${flatVisible[next]?.value}`);
    el?.scrollIntoView({ block: "nearest" });
  }

  const triggerClass = [
    "flex w-full items-center justify-between gap-2 border bg-field px-3 py-2 text-left text-sm text-foreground focus:outline-none focus:ring-2",
    invalid
      ? "border-error ring-2 ring-error/20 focus:ring-error/25"
      : "border-foreground/15 focus:ring-foreground/20 dark:border-foreground/20",
    disabled ? "cursor-not-allowed opacity-60" : "",
    className,
  ]
    .join(" ")
    .trim();

  const menu =
    open && menuBox && typeof document !== "undefined"
      ? createPortal(
          <div
            id={listId}
            role="listbox"
            className="fixed z-[90] overflow-hidden rounded-md border border-foreground/15 bg-background shadow-2xl"
            style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width, maxHeight: menuBox.maxHeight }}
          >
            <div className="border-b border-foreground/10 p-2">
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    moveActive(1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    moveActive(-1);
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    const current = flatVisible.find((option) => option.value === activeValue);
                    if (current) commit(current.value);
                    else if (allowEmpty && !query.trim()) commit("");
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: menuBox.maxHeight - 58 }}>
              {allowEmpty && !query.trim() ? (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected === ""}
                  className={[
                    "flex w-full px-3 py-2 text-left text-sm",
                    selected === "" ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.05]",
                  ].join(" ")}
                  onClick={() => commit("")}
                >
                  {emptyLabel}
                </button>
              ) : null}
              {visibleGroups.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted">{emptyText}</p>
              ) : (
                visibleGroups.map((group) => (
                  <div key={group.label || "__ungrouped"}>
                    {group.label ? (
                      <p className="sticky top-0 bg-foreground/[0.04] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                        {group.label}
                      </p>
                    ) : null}
                    {group.options.map((option) => {
                      const isActive = option.value === activeValue;
                      const isSelected = option.value === selected;
                      return (
                        <button
                          key={option.value}
                          id={`${listId}-${option.value}`}
                          type="button"
                          role="option"
                          disabled={option.disabled}
                          aria-selected={isSelected}
                          className={[
                            "flex w-full flex-col px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40",
                            isActive ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.05]",
                            isSelected ? "font-medium text-foreground" : "text-foreground",
                          ].join(" ")}
                          onMouseEnter={() => setActiveValue(option.value)}
                          onClick={() => commit(option.value)}
                        >
                          <span className="flex items-center">
                            <span className="mr-2 inline-block w-3 shrink-0 text-[10px] text-muted" aria-hidden>
                              {isSelected ? "✓" : ""}
                            </span>
                            {option.label}
                          </span>
                          {option.hint ? <span className="pl-5 text-xs font-normal text-muted">{option.hint}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative">
      {name ? <input type="hidden" name={name} value={selected} required={required && !allowEmpty} /> : null}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={triggerClass}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
          if (open) setQuery("");
        }}
      >
        <span className={selectedOption ? "truncate" : "truncate text-muted"}>
          {selectedOption?.label || (allowEmpty && selected === "" ? emptyLabel : placeholder)}
        </span>
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 7.5l5 5 5-5" />
        </svg>
      </button>
      {menu}
    </div>
  );
}
