"use client";

type TabItem<T extends string> = { readonly id: T; readonly label: string };

export function UiTabs<T extends string>({
  tabs,
  value,
  onChange,
  "aria-label": ariaLabel,
}: {
  tabs: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  "aria-label"?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-foreground/10 pb-1" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={[
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
            ].join(" ")}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
