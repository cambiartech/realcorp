"use client";

import { GlobalLocationFields } from "@/components/global-location-fields";

const fieldClass =
  "w-full border border-foreground/15 bg-field px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20";

export type ClientProfileDefaults = {
  addressLine?: string;
  city?: string;
  state?: string;
  country?: string;
  nextOfKin?: string;
  emergencyPhone?: string;
  declaredUnitsCount?: number | null;
  notes?: string;
};

export function ClientProfileFields({
  defaults,
  showNotes = true,
  locationKey,
}: {
  defaults?: ClientProfileDefaults;
  showNotes?: boolean;
  locationKey?: string;
}) {
  return (
    <>
      <div>
        <label htmlFor="client-address" className="mb-1 block text-sm text-muted">
          Street address <span className="font-normal">(optional)</span>
        </label>
        <input
          id="client-address"
          name="addressLine"
          defaultValue={defaults?.addressLine ?? ""}
          placeholder="House number and street"
          className={fieldClass}
        />
      </div>
      <GlobalLocationFields
        key={locationKey}
        defaultCountry={defaults?.country || "Nigeria"}
        defaultState={defaults?.state}
        defaultCity={defaults?.city}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="client-next-of-kin" className="mb-1 block text-sm text-muted">
            Next of kin <span className="font-normal">(optional)</span>
          </label>
          <input
            id="client-next-of-kin"
            name="nextOfKin"
            defaultValue={defaults?.nextOfKin ?? ""}
            placeholder="Full name"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="client-emergency" className="mb-1 block text-sm text-muted">
            Emergency number <span className="font-normal">(optional)</span>
          </label>
          <input
            id="client-emergency"
            name="emergencyPhone"
            defaultValue={defaults?.emergencyPhone ?? ""}
            placeholder="Phone to call in an emergency"
            className={fieldClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="client-units-total" className="mb-1 block text-sm text-muted">
          Total units <span className="font-normal">(optional)</span>
        </label>
        <input
          id="client-units-total"
          name="declaredUnitsCount"
          type="number"
          min={0}
          max={5000}
          step={1}
          defaultValue={defaults?.declaredUnitsCount ?? ""}
          placeholder="How many units this client has"
          className={fieldClass}
        />
        <p className="mt-1 text-xs text-muted">
          Use this when you know the total but have not linked every unit yet. Linked units still show
          separately.
        </p>
      </div>
      {showNotes ? (
        <div>
          <label htmlFor="client-notes" className="mb-1 block text-sm text-muted">
            Notes <span className="font-normal">(optional)</span>
          </label>
          <textarea
            id="client-notes"
            name="notes"
            rows={3}
            defaultValue={defaults?.notes ?? ""}
            className={fieldClass}
          />
        </div>
      ) : null}
    </>
  );
}
