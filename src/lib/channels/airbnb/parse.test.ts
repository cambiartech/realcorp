import assert from "node:assert/strict";
import test from "node:test";
import { busyRangesFrom, listingDraftsFrom, listingIdFromWebhook } from "./parse";

test("a listing payload becomes an apartment draft", () => {
  const [draft] = listingDraftsFrom({
    listings: [
      {
        id: "153",
        name: "Room 1",
        summary: "Entire flat.",
        person_capacity: 4,
        bedrooms: 2,
        bathrooms: 1,
        address: { city: "Lagos", neighborhood: "Akoka", street: "14 Example Close" },
        pricing_settings: { default_daily_price: 150000, currency: "NGN" },
        photos: [{ url: "https://cdn.example/1.jpg" }],
        amenities: { wifi: { is_present: true } },
      },
    ],
  });
  assert.equal(draft.id, "153");
  assert.equal(draft.name, "Room 1");
  assert.equal(draft.city, "Lagos");
  assert.equal(draft.nightlyPrice, 150000);
  assert.deepEqual(draft.photoUrls, ["https://cdn.example/1.jpg"]);
  assert.deepEqual(draft.amenities, ["wifi"]);
});

test("busy nights become exclusive ranges", () => {
  const ranges = busyRangesFrom({
    days: [
      { date: "2026-12-20", available: false },
      { date: "2026-12-21", available: false },
      { date: "2026-12-22", available: true },
    ],
    reservations: [{ confirmation_code: "HM1", start_date: "2026-12-24", end_date: "2026-12-27", guest_first_name: "Ada" }],
  });
  assert.equal(ranges[0].start, "2026-12-20");
  assert.equal(ranges[0].end, "2026-12-22");
  assert.equal(ranges[1].summary, "Airbnb · Ada");
  assert.equal(listingIdFromWebhook({ listing_id: "153" }), "153");
});
