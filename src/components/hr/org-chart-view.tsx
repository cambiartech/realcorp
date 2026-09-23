"use client";

import { useMemo, useState } from "react";
import { buildOrgForest, type OrgNode, type OrgPerson } from "@/lib/org-chart";

const AVATAR_WASH = [
  "bg-[var(--accent-wash)] text-[var(--accent)]",
  "bg-[var(--info-wash)] text-[var(--info)]",
  "bg-[var(--success-wash)] text-[var(--success)]",
  "bg-[var(--warn-wash)] text-[var(--warn)]",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function washFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i)) % AVATAR_WASH.length;
  return AVATAR_WASH[hash] ?? AVATAR_WASH[0];
}

function OrgCard({
  person,
  you,
  reportCount,
}: {
  person: OrgPerson;
  you?: boolean;
  reportCount?: number;
}) {
  const subtitle = [person.title, person.department].filter(Boolean).join(" · ");
  return (
    <article
      className={[
        "relative w-[180px] rounded-2xl border bg-background px-4 pb-4 pt-5 text-center shadow-[0_8px_24px_-16px_rgba(0,0,0,0.35)]",
        you ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/25" : "border-foreground/10",
      ].join(" ")}
    >
      {you ? (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          You
        </span>
      ) : null}
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.photoUrl}
          alt=""
          className="mx-auto h-16 w-16 rounded-full object-cover ring-4 ring-background"
        />
      ) : (
        <span
          className={[
            "mx-auto flex h-16 w-16 items-center justify-center rounded-full text-sm font-semibold ring-4 ring-background",
            washFor(person.name),
          ].join(" ")}
        >
          {initials(person.name)}
        </span>
      )}
      <p className="mt-3 truncate text-sm font-semibold text-foreground" title={person.name}>
        {person.name}
      </p>
      <p className="mt-0.5 line-clamp-2 min-h-[2rem] text-[11px] leading-4 text-muted" title={subtitle}>
        {subtitle || "Team member"}
      </p>
      {reportCount != null && reportCount > 0 ? (
        <p
          className="mt-2 inline-flex items-center rounded-full border border-foreground/10 bg-foreground/[0.04] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground"
          title={`${reportCount} direct report${reportCount === 1 ? "" : "s"}`}
        >
          {reportCount}
        </p>
      ) : null}
    </article>
  );
}

function CompanyBranch({ node, focusUserId }: { node: OrgNode; focusUserId: string }) {
  return (
    <li>
      <OrgCard person={node} you={node.userId === focusUserId} reportCount={node.children.length} />
      {node.children.length > 0 ? (
        <ul>
          {node.children.map((child) => (
            <CompanyBranch key={child.userId} node={child} focusUserId={focusUserId} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrgChartView({
  lineChain,
  lineReports,
  focusUserId,
  companyPeople,
}: {
  lineChain: OrgPerson[];
  lineReports: OrgPerson[];
  focusUserId: string;
  companyPeople: OrgPerson[] | null;
}) {
  const canSeeCompany = companyPeople != null;
  const [mode, setMode] = useState<"line" | "company">(canSeeCompany ? "company" : "line");
  const forest = useMemo(() => (companyPeople ? buildOrgForest(companyPeople) : []), [companyPeople]);
  const trees = forest.filter((node) => node.children.length > 0);
  const unlinked = forest.filter((node) => node.children.length === 0);
  const showingCompany = canSeeCompany && mode === "company";

  return (
    <div>
      <style>{`
        .org-tree, .org-tree ul { display: flex; justify-content: center; margin: 0; padding: 0; list-style: none; }
        .org-tree ul { position: relative; padding-top: 28px; }
        .org-tree ul::before {
          content: "";
          position: absolute;
          top: 0;
          left: 50%;
          height: 28px;
          border-left: 1px solid color-mix(in srgb, var(--foreground) 22%, transparent);
        }
        .org-tree li {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          padding: 28px 12px 0;
        }
        .org-tree > li { padding-top: 0; }
        .org-tree li::before, .org-tree li::after {
          content: "";
          position: absolute;
          top: 0;
          width: 50%;
          height: 28px;
          border-top: 1px solid color-mix(in srgb, var(--foreground) 22%, transparent);
        }
        .org-tree li::before { right: 50%; }
        .org-tree li::after { left: 50%; border-left: 1px solid color-mix(in srgb, var(--foreground) 22%, transparent); }
        .org-tree li:first-child::before { border: 0; }
        .org-tree li:last-child::after { border: 0; }
        .org-tree li:last-child::before { border-right: 1px solid color-mix(in srgb, var(--foreground) 22%, transparent); }
        .org-tree li:only-child::before, .org-tree li:only-child::after { display: none; }
        .org-tree > li::before, .org-tree > li::after { display: none; }
      `}</style>

      {canSeeCompany ? (
        <div className="mb-5 inline-flex rounded-full border border-foreground/10 bg-background p-1">
          {(
            [
              ["company", "Company"],
              ["line", "My line"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={[
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                mode === id ? "bg-foreground text-background" : "text-muted hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-foreground/10 bg-foreground/[0.025] px-4 py-8">
        {showingCompany ? (
          forest.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">No people records yet.</p>
          ) : trees.length === 0 ? (
            <div className="mx-auto max-w-xl text-center">
              <p className="text-sm font-medium text-foreground">Reports to is not set yet</p>
              <p className="mt-1 text-sm text-muted">
                Open each People record and choose who they report to. The chart draws itself from that.
              </p>
              <ul className="mt-6 flex flex-wrap justify-center gap-4">
                {unlinked.map((node) => (
                  <li key={node.userId} className="list-none">
                    <OrgCard person={node} you={node.userId === focusUserId} />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex min-w-max flex-col items-center gap-10">
              {trees.map((root) => (
                <ul key={root.userId} className="org-tree">
                  <CompanyBranch node={root} focusUserId={focusUserId} />
                </ul>
              ))}
              {unlinked.length > 0 ? (
                <div className="w-full max-w-3xl border-t border-foreground/10 pt-6 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Not linked yet</p>
                  <ul className="mt-4 flex flex-wrap justify-center gap-4">
                    {unlinked.map((node) => (
                      <li key={node.userId} className="list-none">
                        <OrgCard person={node} you={node.userId === focusUserId} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )
        ) : lineChain.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            Your People record is not set up yet, so there is no line to show.
          </p>
        ) : (
          <div className="flex flex-col items-center">
            {lineChain.slice(0, -1).map((person) => (
              <div key={person.userId} className="flex flex-col items-center">
                <OrgCard person={person} />
                <span className="my-1 h-7 w-px bg-foreground/20" aria-hidden />
              </div>
            ))}
            {lineChain.length > 0 ? (
              <ul className="org-tree">
                <li>
                  <OrgCard
                    person={lineChain[lineChain.length - 1]}
                    you={lineChain[lineChain.length - 1].userId === focusUserId}
                    reportCount={lineReports.length}
                  />
                  {lineReports.length > 0 ? (
                    <ul>
                      {lineReports.map((person) => (
                        <li key={person.userId}>
                          <OrgCard person={person} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              </ul>
            ) : null}
            {lineChain.length === 1 && lineReports.length === 0 ? (
              <p className="mt-6 max-w-sm text-center text-sm text-muted">
                HR has not set who you report to yet. Once they do, this line continues up to the top.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
