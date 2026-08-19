import assert from "node:assert/strict";
import test from "node:test";
import {
  inferNigeriaStateFromCity,
  nigeriaCityOptions,
  nigeriaStateOptions,
  resolveNigeriaStateName,
} from "./nigeria-locations";

test("Nigeria states include Lagos without any API or database", () => {
  const states = nigeriaStateOptions();
  assert.ok(states.length >= 36);
  assert.ok(states.some((row) => row.code === "Lagos" && row.name === "Lagos"));
});

test("Lagos cities include Ikeja from the bundled catalog", () => {
  const cities = nigeriaCityOptions("Lagos");
  assert.ok(cities.some((row) => row.name === "Ikeja"));
  assert.ok(cities.some((row) => row.name === "Eti-Osa"));
  assert.deepEqual(nigeriaCityOptions("lagos state").map((row) => row.name), cities.map((row) => row.name));
});

test("Ikeja infers Lagos when the saved state is missing", () => {
  assert.equal(inferNigeriaStateFromCity("Ikeja"), "Lagos");
  assert.equal(resolveNigeriaStateName("Lagos State"), "Lagos");
});
