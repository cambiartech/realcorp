"use client";

import { useEffect, useMemo, useState } from "react";
import { UiSelect } from "@/components/ui-select";
import {
  inferNigeriaStateFromCity,
  isNigeriaStateName,
  nigeriaCityOptions,
  nigeriaStateOptions,
  resolveNigeriaStateName,
} from "@/lib/nigeria-locations";

type CountryOption = { code: string; name: string; emoji?: string };
type StateOption = { code: string; name: string; type?: string | null };
type CityOption = { id: number; name: string };

const NG_COUNTRY: CountryOption = { code: "NG", name: "Nigeria", emoji: "🇳🇬" };
/** Bundled in the browser so Lagos / LGAs never depend on `/api/locations`. */
const NG_STATES = nigeriaStateOptions();

function looksLikeCountryList(rows: unknown[]): boolean {
  if (rows.length < 30) return false;
  let iso = 0;
  let emoji = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as { code?: unknown; name?: unknown; emoji?: unknown };
    const code = String(item.code || "");
    const name = String(item.name || "");
    if (/^[A-Z]{2}$/.test(code) && code.toLowerCase() !== name.toLowerCase()) iso += 1;
    if (typeof item.emoji === "string" && item.emoji) emoji += 1;
  }
  return iso > rows.length * 0.6 || emoji > rows.length * 0.5;
}

function isCountryNameAsRegion(region: string, countryName: string, countryCode: string) {
  const value = region.trim().toLowerCase();
  if (!value) return false;
  if (countryName && value === countryName.trim().toLowerCase()) return true;
  if (countryCode && value === countryCode.trim().toLowerCase()) return true;
  return false;
}

function isNigeriaCountry(code: string, name = "") {
  return code.toUpperCase() === "NG" || name.trim().toLowerCase() === "nigeria";
}

function resolveCountryCode(input: string, countries: CountryOption[] = []) {
  const raw = input.trim();
  if (!raw) return "";
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  if (raw.toLowerCase() === "nigeria") return "NG";
  const target = raw.toLowerCase();
  return (
    countries.find((row) => row.code.toLowerCase() === target || row.name.toLowerCase() === target)?.code ||
    ""
  );
}

function resolveNgStateCode(state: string, city: string) {
  const fromState = resolveNigeriaStateName(state);
  if (isNigeriaStateName(fromState)) return fromState;
  const fromCity = inferNigeriaStateFromCity(city);
  return fromCity || "";
}

async function locationItems<T>(
  type: "countries" | "states" | "cities",
  query: string,
  signal: AbortSignal,
): Promise<T[]> {
  const response = await fetch(`/api/locations?${query}`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Location data is unavailable.");
  const body = (await response.json()) as { type?: string; items?: unknown };
  if (body?.type !== type || !Array.isArray(body.items)) {
    throw new Error("Location data is unavailable.");
  }
  if (type !== "countries" && looksLikeCountryList(body.items)) {
    throw new Error("Location data is unavailable.");
  }
  return body.items as T[];
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
  const initialCountry = defaultCountry || "";
  const initialStateRaw = isCountryNameAsRegion(defaultState || "", initialCountry, "")
    ? ""
    : defaultState || "";
  const initialCountryCode = resolveCountryCode(initialCountry);
  const initialNg = isNigeriaCountry(initialCountryCode, initialCountry);
  const initialState = initialNg ? resolveNgStateCode(initialStateRaw, defaultCity || "") : initialStateRaw;

  const [countries, setCountries] = useState<CountryOption[]>(initialNg ? [NG_COUNTRY] : []);
  const [remoteStates, setRemoteStates] = useState<StateOption[]>([]);
  const [remoteCities, setRemoteCities] = useState<CityOption[]>([]);
  const [countryCode, setCountryCode] = useState(initialCountryCode);
  const [stateCode, setStateCode] = useState(initialNg ? initialState : "");
  const [countryValue, setCountryValue] = useState(initialNg ? "Nigeria" : initialCountry);
  const [stateValue, setStateValue] = useState(initialState);
  const [cityValue, setCityValue] = useState(defaultCity || "");
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  const nigeriaSelected = isNigeriaCountry(countryCode, countryValue);
  const countryOptions = useMemo(() => {
    if (countries.some((row) => row.code === "NG")) return countries;
    return [NG_COUNTRY, ...countries].sort((a, b) => a.name.localeCompare(b.name));
  }, [countries]);

  const states = nigeriaSelected ? NG_STATES : remoteStates;
  const cities = nigeriaSelected ? nigeriaCityOptions(stateCode) : remoteCities;

  useEffect(() => {
    const controller = new AbortController();
    locationItems<CountryOption>("countries", "type=countries", controller.signal)
      .then((rows) => {
        setCountries(rows.length ? rows : [NG_COUNTRY]);
        setCountryCode((current) => {
          if (current) return current;
          if (!defaultCountry) return current;
          const matchCode = resolveCountryCode(defaultCountry, rows);
          if (!matchCode) return current;
          const match = rows.find((row) => row.code === matchCode) || NG_COUNTRY;
          setCountryValue(match.name);
          return match.code;
        });
      })
      .catch((caught) => {
        if ((caught as Error).name === "AbortError") return;
        setCountries((current) => (current.length ? current : [NG_COUNTRY]));
      });
    return () => controller.abort();
  }, [reloadTick, defaultCountry]);

  useEffect(() => {
    if (!nigeriaSelected || !initialState || initialState === initialStateRaw) return;
    onLocationChange?.({ country: "Nigeria", state: initialState, city: defaultCity || "" });
    // Push inferred state (e.g. Ikeja → Lagos) into the parent form once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!countryCode || nigeriaSelected) {
      setRemoteStates([]);
      setRemoteCities([]);
      return;
    }
    const controller = new AbortController();
    locationItems<StateOption>(
      "states",
      `type=states&country=${encodeURIComponent(countryCode)}`,
      controller.signal,
    )
      .then((rows) => {
        setRemoteStates(rows);
        const usableDefault =
          defaultState && !isCountryNameAsRegion(defaultState, countryValue, countryCode)
            ? defaultState
            : "";
        if (!usableDefault) {
          setStateCode((current) => (rows.some((row) => row.code === current) ? current : ""));
          return;
        }
        const target = usableDefault.toLowerCase();
        const match = rows.find(
          (row) => row.code.toLowerCase() === target || row.name.toLowerCase() === target,
        );
        if (match) {
          setStateCode(match.code);
          setStateValue(match.name);
        }
      })
      .catch((caught) => {
        if ((caught as Error).name !== "AbortError") setError("Could not load states or provinces.");
      });
    return () => controller.abort();
  }, [countryCode, countryValue, defaultState, nigeriaSelected, reloadTick]);

  useEffect(() => {
    if (!countryCode || !stateCode || nigeriaSelected) {
      if (!nigeriaSelected) setRemoteCities([]);
      return;
    }
    const controller = new AbortController();
    locationItems<CityOption>(
      "cities",
      `type=cities&country=${encodeURIComponent(countryCode)}&state=${encodeURIComponent(stateCode)}`,
      controller.signal,
    )
      .then((rows) => {
        setRemoteCities(rows);
        if (defaultCity) {
          const match = rows.find((row) => row.name.toLowerCase() === defaultCity.toLowerCase());
          if (match) setCityValue(match.name);
        }
      })
      .catch((caught) => {
        if ((caught as Error).name !== "AbortError") setError("Could not load cities.");
      });
    return () => controller.abort();
  }, [countryCode, defaultCity, stateCode, nigeriaSelected, reloadTick]);

  return (
    <div className={className}>
      <input type="hidden" name={countryName} value={countryValue} />
      <input type="hidden" name={stateName} value={stateValue} />
      <input type="hidden" name={cityName} value={cityValue} />

      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-foreground">{countryLabel}</span>
        <UiSelect
          value={countryCode}
          required={required}
          onChange={(event) => {
            const nextCode = event.target.value;
            const nextCountry = countryOptions.find((row) => row.code === nextCode)?.name || "";
            setCountryCode(nextCode);
            setCountryValue(nextCountry);
            setStateCode("");
            setStateValue("");
            setCityValue("");
            setRemoteStates([]);
            setRemoteCities([]);
            setError("");
            onLocationChange?.({ country: nextCountry, state: "", city: "" });
          }}
        >
          <option value="">Select country</option>
          {countryOptions.map((country) => (
            <option key={country.code} value={country.code}>
              {country.emoji ? `${country.emoji} ` : ""}
              {country.name}
            </option>
          ))}
        </UiSelect>
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-foreground">{stateLabel}</span>
        <UiSelect
          value={stateCode}
          required={required && states.length > 0}
          disabled={!countryCode}
          onChange={(event) => {
            const nextCode = event.target.value;
            const nextState = states.find((row) => row.code === nextCode)?.name || nextCode;
            setStateCode(nextCode);
            setStateValue(nextState);
            setCityValue("");
            setRemoteCities([]);
            setError("");
            onLocationChange?.({ country: countryValue, state: nextState, city: "" });
          }}
        >
          <option value="">
            {!countryCode ? "Select country first" : states.length === 0 ? "No regions available" : "Select region"}
          </option>
          {states.map((state) => (
            <option key={state.code} value={state.code}>
              {state.name}
            </option>
          ))}
        </UiSelect>
      </label>

      <label className="text-sm">
        <span className="mb-1 block text-xs font-medium text-foreground">{cityLabel}</span>
        <UiSelect
          value={cityValue}
          required={required && cities.length > 0}
          disabled={!stateCode}
          onChange={(event) => {
            setCityValue(event.target.value);
            onLocationChange?.({
              country: countryValue,
              state: stateValue,
              city: event.target.value,
            });
          }}
        >
          <option value="">
            {!stateCode ? "Select state first" : cities.length === 0 ? "No cities available" : "Select city"}
          </option>
          {cities.map((city) => (
            <option key={`${city.id}-${city.name}`} value={city.name}>
              {city.name}
            </option>
          ))}
        </UiSelect>
      </label>

      {error ? (
        <p className="text-xs text-[var(--danger)] sm:col-span-3">
          {error}{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              setError("");
              setReloadTick((n) => n + 1);
            }}
          >
            Try again
          </button>
        </p>
      ) : null}
    </div>
  );
}
