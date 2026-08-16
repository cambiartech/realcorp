"use client";

import { useEffect, useState } from "react";

type CountryOption = { code: string; name: string; emoji?: string };
type StateOption = { code: string; name: string; type?: string | null };
type CityOption = { id: number; name: string };

const fieldClass =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 disabled:cursor-not-allowed disabled:opacity-60";

async function locationRows<T>(query: string, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(`/api/locations?${query}`, { signal });
  if (!response.ok) throw new Error("Location data is unavailable.");
  return (await response.json()) as T[];
}

export function GlobalLocationFields({
  countryName = "country",
  stateName = "state",
  cityName = "city",
  defaultCountry = "",
  defaultState = "",
  defaultCity = "",
  countryLabel = "Country",
  stateLabel = "State / province",
  cityLabel = "City",
  required,
  className = "grid gap-3 sm:grid-cols-3",
  onLocationChange,
}: {
  countryName?: string;
  stateName?: string;
  cityName?: string;
  defaultCountry?: string | null;
  defaultState?: string | null;
  defaultCity?: string | null;
  countryLabel?: string;
  stateLabel?: string;
  cityLabel?: string;
  required?: boolean;
  className?: string;
  onLocationChange?: (location: { country: string; state: string; city: string }) => void;
}) {
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [states, setStates] = useState<StateOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [countryCode, setCountryCode] = useState(
    defaultCountry && /^[A-Za-z]{2}$/.test(defaultCountry) ? defaultCountry.toUpperCase() : "",
  );
  const [stateCode, setStateCode] = useState("");
  const [countryValue, setCountryValue] = useState(defaultCountry || "");
  const [stateValue, setStateValue] = useState(defaultState || "");
  const [cityValue, setCityValue] = useState(defaultCity || "");
  const [error, setError] = useState("");
  const [countryReload, setCountryReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    locationRows<CountryOption>("type=countries", controller.signal)
      .then((rows) => {
        setCountries(rows);
        if (!countryCode && defaultCountry) {
          const target = defaultCountry.toLowerCase();
          const match = rows.find(
            (row) => row.code.toLowerCase() === target || row.name.toLowerCase() === target,
          );
          if (match) {
            setCountryCode(match.code);
            setCountryValue(match.name);
          }
        }
      })
      .catch((caught) => {
        if ((caught as Error).name !== "AbortError") setError("Could not load countries.");
      });
    return () => controller.abort();
  }, [countryCode, countryReload, defaultCountry]);

  useEffect(() => {
    if (!countryCode) return;
    const controller = new AbortController();
    locationRows<StateOption>(`type=states&country=${encodeURIComponent(countryCode)}`, controller.signal)
      .then((rows) => {
        setStates(rows);
        if (!stateCode && defaultState) {
          const target = defaultState.toLowerCase();
          const match = rows.find(
            (row) => row.code.toLowerCase() === target || row.name.toLowerCase() === target,
          );
          if (match) {
            setStateCode(match.code);
            setStateValue(match.name);
          }
        }
      })
      .catch((caught) => {
        if ((caught as Error).name !== "AbortError") setError("Could not load states or provinces.");
      });
    return () => controller.abort();
  }, [countryCode, defaultState, stateCode]);

  useEffect(() => {
    if (!countryCode || !stateCode) return;
    const controller = new AbortController();
    locationRows<CityOption>(
      `type=cities&country=${encodeURIComponent(countryCode)}&state=${encodeURIComponent(stateCode)}`,
      controller.signal,
    )
      .then((rows) => {
        setCities(rows);
        if (defaultCity) {
          const match = rows.find((row) => row.name.toLowerCase() === defaultCity.toLowerCase());
          if (match) setCityValue(match.name);
        }
      })
      .catch((caught) => {
        if ((caught as Error).name !== "AbortError") setError("Could not load cities.");
      });
    return () => controller.abort();
  }, [countryCode, defaultCity, stateCode]);

  return (
    <div className={className}>
      <input type="hidden" name={countryName} value={countryValue} />
      <input type="hidden" name={stateName} value={stateValue} />
      <input type="hidden" name={cityName} value={cityValue} />

      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-foreground">{countryLabel}</span>
        <select
          value={countryCode}
          required={required}
          className={fieldClass}
          onChange={(event) => {
            const nextCode = event.target.value;
            const nextCountry = countries.find((row) => row.code === nextCode)?.name || "";
            setCountryCode(nextCode);
            setCountryValue(nextCountry);
            setStateCode("");
            setStateValue("");
            setCityValue("");
            setStates([]);
            setCities([]);
            setError("");
            onLocationChange?.({ country: nextCountry, state: "", city: "" });
          }}
        >
          <option value="">Select country</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.emoji ? `${country.emoji} ` : ""}
              {country.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-foreground">{stateLabel}</span>
        <select
          value={stateCode}
          required={required && states.length > 0}
          disabled={!countryCode || states.length === 0}
          className={fieldClass}
          onChange={(event) => {
            const nextCode = event.target.value;
            const nextState = states.find((row) => row.code === nextCode)?.name || "";
            setStateCode(nextCode);
            setStateValue(nextState);
            setCityValue("");
            setCities([]);
            setError("");
            onLocationChange?.({ country: countryValue, state: nextState, city: "" });
          }}
        >
          <option value="">{countryCode && states.length === 0 ? "No regions available" : "Select region"}</option>
          {states.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-foreground">{cityLabel}</span>
        <select
          value={cityValue}
          required={required && cities.length > 0}
          disabled={!stateCode || cities.length === 0}
          className={fieldClass}
          onChange={(event) => {
            setCityValue(event.target.value);
            onLocationChange?.({
              country: countryValue,
              state: stateValue,
              city: event.target.value,
            });
          }}
        >
          <option value="">{stateCode && cities.length === 0 ? "No cities available" : "Select city"}</option>
          {cities.map((city) => (
            <option key={city.id} value={city.name}>
              {city.name}
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p className="text-xs text-[var(--danger)] sm:col-span-3">
          {error}{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              setError("");
              setCountryReload((n) => n + 1);
            }}
          >
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}
