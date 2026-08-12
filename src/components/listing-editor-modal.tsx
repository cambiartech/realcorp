"use client";

import { useActionState, useEffect, useState } from "react";
import { ModalOverlay } from "@/components/modal-overlay";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { ButtonSpinner } from "@/components/button-spinner";
import { ListingImageUpload } from "@/components/listing-image-upload";
import { TagInput } from "@/components/tag-input";
import { GlobalLocationFields } from "@/components/global-location-fields";
import { MODAL_PANEL_LG } from "@/lib/modal-panel";
import { updateProjectListing } from "@/app/[tenantSlug]/projects/actions";

export type ListingProject = {
  id: string;
  name: string;
  isPublished: boolean;
  listingDescription: string | null;
  locationCity: string | null;
  locationState: string | null;
  locationCountry?: string | null;
  locationAddress: string | null;
  coverImageUrl: string | null;
  galleryUrls: string[];
  amenities: string[];
};

type ActionResult = { ok: true } | { ok: false; error: string };

const initial: ActionResult | null = null;

const FIELD_CLASS =
  "w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20";

export function ListingEditorModal({
  tenantSlug,
  project,
  onClose,
}: {
  tenantSlug: string;
  project: ListingProject;
  onClose: () => void;
}) {
  const [coverUrl, setCoverUrl] = useState(project.coverImageUrl ?? "");
  const [galleryUrls, setGalleryUrls] = useState<string[]>(project.galleryUrls);
  const [state, formAction, pending] = useActionState(
    updateProjectListing.bind(null, tenantSlug, project.id),
    initial,
  );
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      showSnackbar("Listing saved.", "success");
      queueMicrotask(onClose);
    } else {
      showSnackbar(state.error, "error");
    }
  }, [state, showSnackbar, onClose]);

  return (
    <ModalOverlay open onClose={onClose} panelClassName={MODAL_PANEL_LG}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Public listing</h2>
          <p className="text-xs text-muted">{project.name} — shown on your Explore page, embeds, and API.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
          aria-label="Close modal"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <form action={formAction} className="mt-4 space-y-4">
        {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}

        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2.5">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={project.isPublished}
            className="h-4 w-4 accent-foreground"
          />
          <span className="text-sm font-medium text-foreground">Publish this project publicly</span>
        </label>

        <div>
          <label className="mb-1 block text-sm text-muted">Description</label>
          <textarea
            name="listingDescription"
            rows={3}
            defaultValue={project.listingDescription ?? ""}
            placeholder="What makes this project special? Buyers see this on the listing card."
            className={FIELD_CLASS}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <GlobalLocationFields
            countryName="locationCountry"
            stateName="locationState"
            cityName="locationCity"
            defaultCountry={project.locationCountry || "Nigeria"}
            defaultState={project.locationState}
            defaultCity={project.locationCity}
            className="grid gap-3 sm:col-span-3 sm:grid-cols-3"
          />
          <div>
            <label className="mb-1 block text-sm text-muted">Address (optional)</label>
            <input
              name="locationAddress"
              defaultValue={project.locationAddress ?? ""}
              className={FIELD_CLASS}
            />
          </div>
        </div>

        <ListingImageUpload
          tenantSlug={tenantSlug}
          projectId={project.id}
          coverUrl={coverUrl}
          galleryUrls={galleryUrls}
          onCoverChange={setCoverUrl}
          onGalleryChange={setGalleryUrls}
        />

        <div>
          <label className="mb-1 block text-sm text-muted">Amenities</label>
          <TagInput name="amenities" initialTags={project.amenities} placeholder="e.g. Swimming pool" />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <ButtonSpinner /> : null}
            {pending ? "Saving…" : "Save listing"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
