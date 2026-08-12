"use client";

import { GlobalLocationFields } from "@/components/global-location-fields";

export function HrLocationFields({
  stateName,
  cityName,
  stateDefault,
  cityDefault,
  countryName,
  countryDefault,
  countryLabel = "Country",
  stateLabel = "State",
  cityLabel = "City / LGA",
}: {
  stateName: string;
  cityName: string;
  stateDefault?: string;
  cityDefault?: string;
  countryName?: string;
  countryDefault?: string;
  countryLabel?: string;
  stateLabel?: string;
  cityLabel?: string;
}) {
  return (
    <GlobalLocationFields
      countryName={countryName || stateName.replace(/State$/, "Country")}
      stateName={stateName}
      cityName={cityName}
      defaultCountry={countryDefault || "Nigeria"}
      defaultState={stateDefault}
      defaultCity={cityDefault}
      countryLabel={countryLabel}
      stateLabel={stateLabel}
      cityLabel={cityLabel}
      className="grid gap-3 sm:grid-cols-3"
    />
  );
}
