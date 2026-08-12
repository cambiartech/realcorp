"use client";

import Link from "next/link";
import { useState } from "react";
import { ExternalLink, Globe, Pencil } from "lucide-react";
import { ListingEditorModal, type ListingProject } from "@/components/listing-editor-modal";

type Props = {
  tenantSlug: string;
  canManage: boolean;
  projects: ListingProject[];
};

export function ListingsWorkspace({ tenantSlug, canManage, projects }: Props) {
  const [editing, setEditing] = useState<ListingProject | null>(null);
  const publishedCount = projects.filter((p) => p.isPublished).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Public listings</h1>
          <p className="mt-1 text-sm text-muted">
            Manage how projects appear on your Explore page, website embeds, and public API.
          </p>
          <p className="mt-2 text-xs text-muted">
            {publishedCount} of {projects.length} project{projects.length === 1 ? "" : "s"} published
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/explore/${tenantSlug}`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-md border border-foreground/15 px-3 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
          >
            <Globe className="h-4 w-4" />
            View Explore page
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-foreground/15 px-4 py-10 text-center text-sm text-muted">
          No projects yet. Create a project first, then publish its listing here.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <article
              key={project.id}
              className="overflow-hidden rounded-lg border border-foreground/10 bg-foreground/[0.02]"
            >
              <div className="relative aspect-[16/10] bg-foreground/[0.04]">
                {project.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.coverImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted">
                    No cover image
                  </div>
                )}
                <span
                  className={[
                    "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    project.isPublished
                      ? "bg-[var(--success)] text-white"
                      : "bg-foreground/70 text-background",
                  ].join(" ")}
                >
                  {project.isPublished ? "Live" : "Draft"}
                </span>
              </div>
              <div className="p-4">
                <h2 className="font-semibold text-foreground">{project.name}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-muted">
                  {[project.locationCity, project.locationState, project.locationCountry]
                    .filter(Boolean)
                    .join(", ") ||
                    project.listingDescription ||
                    "No location or description yet"}
                </p>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => setEditing(project)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit listing
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {editing ? (
        <ListingEditorModal tenantSlug={tenantSlug} project={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
