"use client";

import { useEffect, useState } from "react";
import { HrFormCombobox, HrFormSelect } from "@/components/hr/hr-form-field";

export function HrLocationFields({
  stateName,
  cityName,
  stateDefault,
  cityDefault,
  stateLabel = "State",
  cityLabel = "City / LGA",
}: {
  stateName: string;
  cityName: string;
  stateDefault?: string;
  cityDefault?: string;
  stateLabel?: string;
  cityLabel?: string;
}) {
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [cityTotal, setCityTotal] = useState(0);
  const [state, setState] = useState(stateDefault ?? "");

  useEffect(() => {
    fetch("/api/hr/resources/nigeria-states")
      .then((r) => r.json())
      .then((d) => setStates(Array.isArray(d.states) ? d.states : []))
      .catch(() => setStates([]));
  }, []);

  useEffect(() => {
    if (!state) {
      setCities([]);
      setCityTotal(0);
      return;
    }
    fetch(`/api/hr/resources/nigeria-cities?state=${encodeURIComponent(state)}`)
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d.cities) ? d.cities : [];
        setCities(list);
        setCityTotal(typeof d.total === "number" ? d.total : list.length);
      })
      .catch(() => {
        setCities([]);
        setCityTotal(0);
      });
  }, [state]);

  const cityHint =
    cityTotal > 0 && state
      ? `${cityTotal} LGAs in ${state} — type to search (all states use the same full list from our database)`
      : undefined;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <HrFormSelect
        label={stateLabel}
        name={stateName}
        defaultValue={stateDefault}
        options={[{ value: "", label: "Select state…" }, ...states.map((s) => ({ value: s, label: s }))]}
        onChange={(e) => setState(e.target.value)}
      />
      <HrFormCombobox
        label={cityLabel}
        name={cityName}
        defaultValue={cityDefault}
        placeholder={state ? "Type or pick from list…" : "Select state first"}
        disabled={!state}
        options={cities}
        hint={cityHint}
      />
    </div>
  );
}
