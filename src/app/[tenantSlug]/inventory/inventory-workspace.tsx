"use client";

import {
  createInventoryItem,
  receiveInventoryStock,
  recordManualInventoryPrice,
  setInventoryPartyActive,
  upsertInventoryParty,
} from "@/app/[tenantSlug]/inventory/actions";
import { ModalOverlay } from "@/components/modal-overlay";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { InventoryItemClass } from "@/generated/prisma";
import { downloadCsv } from "@/lib/table-export";
import { MODAL_PANEL_FORM, MODAL_PANEL_SM } from "@/lib/modal-panel";
import { Download, Package, Plus, TrendingUp } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TabId = "catalog" | "stock" | "receive" | "suppliers" | "artisans" | "prices";

const VALID_TABS = new Set<TabId>(["catalog", "stock", "receive", "suppliers", "artisans", "prices"]);

function tabFromSearch(value: string | null): TabId {
  if (value && VALID_TABS.has(value as TabId)) return value as TabId;
  return "catalog";
}

const inputClass =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20";

function classLabel(value: string) {
  if (value === "MATERIAL") return "Material";
  if (value === "CONSUMABLE") return "Consumable";
  if (value === "EQUIPMENT") return "Plant / machine type";
  return "Tool";
}

function money(value: number | null | undefined, currency: string) {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${currency} ${value.toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

function pctChange(latest: number | null, previous: number | null) {
  if (latest == null || previous == null || previous === 0) return null;
  return ((latest - previous) / previous) * 100;
}

export function InventoryWorkspace(props: {
  tenantSlug: string;
  currency: string;
  canManage: boolean;
  canRecord: boolean;
  items: Array<{
    id: string;
    name: string;
    sku: string;
    itemClass: string;
    unitOfMeasure: string;
    reorderPoint: number;
    onHand: number;
    currentUnitPrice: number | null;
  }>;
  locations: Array<{ id: string; name: string; kind: string; projectName: string }>;
  balances: Array<{
    id: string;
    itemId: string;
    itemName: string;
    unitOfMeasure: string;
    locationId: string;
    locationName: string;
    quantity: number;
    reorderPoint: number;
  }>;
  parties: Array<{
    id: string;
    kind: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    specialty: string;
    notes: string;
    isActive: boolean;
  }>;
  pricePoints: Array<{
    id: string;
    itemId: string;
    itemName: string;
    unitPrice: number;
    currency: string;
    effectiveAt: string;
    effectiveAtValue: string;
    source: string;
    partyName: string;
    notes: string;
  }>;
  priceSummaries: Array<{
    itemId: string;
    itemName: string;
    unitOfMeasure: string;
    latest: number | null;
    previous: number | null;
    lastPartyName: string;
    currency: string;
  }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState<TabId>(() => tabFromSearch(searchParams.get("tab")));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setTab(tabFromSearch(searchParams.get("tab")));
  }, [searchParams]);

  function selectTab(next: TabId) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/${props.tenantSlug}/inventory?${params.toString()}`, { scroll: false });
  }

  const [showItem, setShowItem] = useState(false);
  const [showParty, setShowParty] = useState<null | "SUPPLIER" | "ARTISAN">(null);
  const [showPrice, setShowPrice] = useState(false);
  const [priceItemFilter, setPriceItemFilter] = useState("");

  const suppliers = useMemo(
    () => props.parties.filter((p) => p.kind === "SUPPLIER"),
    [props.parties],
  );
  const artisans = useMemo(
    () => props.parties.filter((p) => p.kind === "ARTISAN"),
    [props.parties],
  );
  const stockItems = useMemo(
    () => props.items.filter((i) => i.itemClass !== "EQUIPMENT"),
    [props.items],
  );
  const filteredPoints = useMemo(() => {
    if (!priceItemFilter) return props.pricePoints;
    return props.pricePoints.filter((p) => p.itemId === priceItemFilter);
  }, [props.pricePoints, priceItemFilter]);

  async function finish(result: { ok: boolean; error?: string }, success: string) {
    if (!result.ok) {
      showSnackbar(result.error || "Could not complete the action.", "error");
      return false;
    }
    showSnackbar(success, "success");
    router.refresh();
    return true;
  }

  function exportPricesCsv() {
    const keys = ["item", "date", "unitPrice", "currency", "source", "supplier", "notes"];
    const headers = ["Item", "Date", "Unit price", "Currency", "Source", "Supplier / contact", "Notes"];
    const rows = filteredPoints.map((p) => ({
      item: p.itemName,
      date: p.effectiveAt,
      unitPrice: p.unitPrice,
      currency: p.currency,
      source: p.source,
      supplier: p.partyName,
      notes: p.notes,
    }));
    downloadCsv(`inventory-prices-${props.tenantSlug}`, headers, rows, keys);
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "catalog", label: "Catalog" },
    { id: "stock", label: "Stock" },
    { id: "receive", label: "Receive" },
    { id: "suppliers", label: "Suppliers" },
    { id: "artisans", label: "Artisans" },
    { id: "prices", label: "Prices" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Operations</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Inventory</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Materials catalog, suppliers and artisans, stock receive, and historical unit prices for
            building reports.
          </p>
        </div>
        <Package className="h-8 w-8 text-muted" />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-foreground/10 pb-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectTab(item.id)}
            className={[
              "rounded-md px-3 py-2 text-sm font-medium",
              tab === item.id ? "bg-foreground text-background" : "text-muted hover:bg-foreground/[0.06]",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "catalog" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">Shared with Facility for site usage and damages.</p>
            {props.canManage ? (
              <button
                type="button"
                onClick={() => setShowItem(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background"
              >
                <Plus className="h-3.5 w-3.5" /> Add item
              </button>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-lg border border-foreground/10">
            <div className="divide-y divide-foreground/10">
              {props.items.map((item) => (
                <div
                  key={item.id}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[1.4fr_.8fr_.7fr_.7fr_.7fr]"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <p className="text-xs text-muted">
                      {classLabel(item.itemClass)}
                      {item.sku ? ` · ${item.sku}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-muted">UoM: {item.unitOfMeasure}</p>
                  <p className="text-xs text-muted">On hand: {item.onHand}</p>
                  <p className="text-xs text-muted">Reorder: {item.reorderPoint}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {money(item.currentUnitPrice, props.currency)}
                  </p>
                </div>
              ))}
              {!props.items.length ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No catalog items yet.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "stock" ? (
        <div className="overflow-hidden rounded-lg border border-foreground/10">
          <div className="divide-y divide-foreground/10">
            {props.balances.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{row.itemName}</p>
                  <p className="text-xs text-muted">{row.locationName}</p>
                </div>
                <p className="text-sm font-bold text-foreground">
                  {row.quantity} {row.unitOfMeasure}
                </p>
              </div>
            ))}
            {!props.balances.length ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                No stock on hand yet. Receive materials to get started.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "receive" ? (
        <div className="rounded-lg border border-foreground/10 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-foreground">Receive stock</h2>
          <p className="mt-1 text-xs text-muted">
            Enter unit price to log historical pricing (e.g. cement last month vs this month).
          </p>
          {props.canRecord ? (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = Object.fromEntries(new FormData(event.currentTarget));
                setPending(true);
                try {
                  const ok = await finish(
                    await receiveInventoryStock(props.tenantSlug, data),
                    "Stock received.",
                  );
                  if (ok) event.currentTarget.reset();
                } finally {
                  setPending(false);
                }
              }}
            >
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-medium">Material</span>
                <UiSelect name="itemId" required defaultValue="">
                  <option value="">Select item</option>
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unitOfMeasure})
                    </option>
                  ))}
                </UiSelect>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium">Store</span>
                <UiSelect name="toLocationId" required defaultValue="">
                  <option value="">Select store</option>
                  {props.locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                      {loc.projectName ? ` · ${loc.projectName}` : ""}
                    </option>
                  ))}
                </UiSelect>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium">Quantity</span>
                <input name="quantity" type="number" min={0.01} step="0.01" required className={inputClass} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium">Unit price ({props.currency})</span>
                <input name="unitPrice" type="number" min={0} step="0.01" className={inputClass} placeholder="Optional but recommended" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium">Supplier</span>
                <UiSelect name="partyId" defaultValue="">
                  <option value="">—</option>
                  {suppliers
                    .filter((s) => s.isActive)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </UiSelect>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-xs font-medium">Notes</span>
                <input name="notes" className={inputClass} placeholder="Delivery note / GRN" />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Receive stock"}
                </button>
              </div>
            </form>
          ) : (
            <p className="mt-4 text-sm text-muted">You do not have permission to receive stock.</p>
          )}
        </div>
      ) : null}

      {tab === "suppliers" || tab === "artisans" ? (
        <PartyPanel
          kind={tab === "suppliers" ? "SUPPLIER" : "ARTISAN"}
          rows={tab === "suppliers" ? suppliers : artisans}
          canManage={props.canManage}
          pending={pending}
          onAdd={() => setShowParty(tab === "suppliers" ? "SUPPLIER" : "ARTISAN")}
          onToggle={async (id, isActive) => {
            setPending(true);
            try {
              await finish(
                await setInventoryPartyActive(props.tenantSlug, id, isActive),
                isActive ? "Contact reactivated." : "Contact archived.",
              );
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}

      {tab === "prices" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Material price history</h2>
              <p className="text-xs text-muted">
                Compare what you paid last month vs now — auto-logged on receive, or add a manual price.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportPricesCsv}
                className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
              {props.canManage ? (
                <button
                  type="button"
                  onClick={() => setShowPrice(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background"
                >
                  <TrendingUp className="h-3.5 w-3.5" /> Manual price
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {props.priceSummaries.map((row) => {
              const change = pctChange(row.latest, row.previous);
              return (
                <article key={row.itemId} className="rounded-lg border border-foreground/10 p-4">
                  <p className="text-sm font-semibold text-foreground">{row.itemName}</p>
                  <p className="mt-1 text-xs text-muted">per {row.unitOfMeasure}</p>
                  <p className="mt-3 text-xl font-bold text-foreground">{money(row.latest, row.currency)}</p>
                  <p className="mt-1 text-xs text-muted">
                    Previous: {money(row.previous, row.currency)}
                    {change != null ? ` · ${change > 0 ? "+" : ""}${change.toFixed(1)}%` : ""}
                  </p>
                  {row.lastPartyName ? (
                    <p className="mt-2 text-[11px] text-muted">Last contact: {row.lastPartyName}</p>
                  ) : null}
                </article>
              );
            })}
            {!props.priceSummaries.length ? (
              <p className="text-sm text-muted sm:col-span-2">No price points yet — receive stock with a unit price.</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-[12rem] flex-1 text-sm">
              <span className="mb-1 block text-xs font-medium">Filter by item</span>
              <UiSelect value={priceItemFilter} onChange={(e) => setPriceItemFilter(e.target.value)}>
                <option value="">All items</option>
                {props.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </UiSelect>
            </label>
          </div>

          <div className="overflow-hidden rounded-lg border border-foreground/10">
            <div className="divide-y divide-foreground/10">
              {filteredPoints.map((point) => (
                <div key={point.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{point.itemName}</p>
                    <p className="text-xs text-muted">
                      {point.effectiveAt} · {point.source === "RECEIVE" ? "From receive" : "Manual"}
                      {point.partyName ? ` · ${point.partyName}` : ""}
                    </p>
                    {point.notes ? <p className="mt-1 text-[11px] text-muted">{point.notes}</p> : null}
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    {money(point.unitPrice, point.currency || props.currency)}
                  </p>
                </div>
              ))}
              {!filteredPoints.length ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No price history for this filter.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ModalOverlay open={showItem} onClose={() => !pending && setShowItem(false)} panelClassName={MODAL_PANEL_FORM}>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setPending(true);
            try {
              if (await finish(await createInventoryItem(props.tenantSlug, data), "Catalog item added.")) {
                setShowItem(false);
              }
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="border-b border-foreground/10 px-5 py-4">
            <h2 className="text-lg font-semibold">Add catalog item</h2>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium">Name</span>
              <input name="name" required className={inputClass} placeholder="Cement" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium">SKU</span>
              <input name="sku" className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium">Class</span>
              <UiSelect name="itemClass" defaultValue={InventoryItemClass.MATERIAL}>
                <option value={InventoryItemClass.MATERIAL}>Material</option>
                <option value={InventoryItemClass.CONSUMABLE}>Consumable</option>
                <option value={InventoryItemClass.TOOL}>Tool</option>
                <option value={InventoryItemClass.EQUIPMENT}>Plant / machine type</option>
              </UiSelect>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium">Unit of measure</span>
              <input name="unitOfMeasure" required defaultValue="bag" className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium">Reorder point</span>
              <input name="reorderPoint" type="number" min={0} step="0.01" defaultValue={0} className={inputClass} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium">Notes</span>
              <input name="notes" className={inputClass} />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-foreground/10 px-5 py-4">
            <button type="button" onClick={() => setShowItem(false)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay
        open={Boolean(showParty)}
        onClose={() => !pending && setShowParty(null)}
        panelClassName={MODAL_PANEL_FORM}
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!showParty) return;
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setPending(true);
            try {
              if (
                await finish(
                  await upsertInventoryParty(props.tenantSlug, { ...data, kind: showParty }),
                  `${showParty === "SUPPLIER" ? "Supplier" : "Artisan"} saved.`,
                )
              ) {
                setShowParty(null);
              }
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="border-b border-foreground/10 px-5 py-4">
            <h2 className="text-lg font-semibold">
              Add {showParty === "ARTISAN" ? "artisan" : "supplier"}
            </h2>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium">Name</span>
              <input name="name" required className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium">Phone</span>
              <input name="phone" className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium">Email</span>
              <input name="email" type="email" className={inputClass} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium">
                {showParty === "ARTISAN" ? "Specialty (e.g. Stone, Iron works)" : "Specialty / materials"}
              </span>
              <input name="specialty" className={inputClass} placeholder="Cement, Stone…" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium">Address</span>
              <input name="address" className={inputClass} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-xs font-medium">Notes</span>
              <input name="notes" className={inputClass} />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-foreground/10 px-5 py-4">
            <button type="button" onClick={() => setShowParty(null)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay open={showPrice} onClose={() => !pending && setShowPrice(false)} panelClassName={MODAL_PANEL_SM}>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setPending(true);
            try {
              if (await finish(await recordManualInventoryPrice(props.tenantSlug, data), "Price recorded.")) {
                setShowPrice(false);
              }
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="border-b border-foreground/10 px-5 py-4">
            <h2 className="text-lg font-semibold">Manual price update</h2>
            <p className="text-sm text-muted">Use when you know a market price without receiving stock yet.</p>
          </div>
          <div className="grid gap-3 p-5">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium">Item</span>
              <UiSelect name="itemId" required defaultValue="">
                <option value="">Select item</option>
                {stockItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </UiSelect>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium">Unit price ({props.currency})</span>
              <input name="unitPrice" type="number" min={0.01} step="0.01" required className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium">Effective date</span>
              <input name="effectiveAt" type="date" className={inputClass} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium">Supplier / contact (optional)</span>
              <UiSelect name="partyId" defaultValue="">
                <option value="">—</option>
                {props.parties
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.kind === "ARTISAN" ? "Artisan" : "Supplier"})
                    </option>
                  ))}
              </UiSelect>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium">Notes</span>
              <input name="notes" className={inputClass} />
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-foreground/10 px-5 py-4">
            <button type="button" onClick={() => setShowPrice(false)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
              {pending ? "Saving…" : "Save price"}
            </button>
          </div>
        </form>
      </ModalOverlay>
    </div>
  );
}

function PartyPanel({
  kind,
  rows,
  canManage,
  pending,
  onAdd,
  onToggle,
}: {
  kind: "SUPPLIER" | "ARTISAN";
  rows: Array<{
    id: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    specialty: string;
    notes: string;
    isActive: boolean;
  }>;
  canManage: boolean;
  pending: boolean;
  onAdd: () => void;
  onToggle: (id: string, isActive: boolean) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {kind === "SUPPLIER"
            ? "Vendors for cement, stone, iron, and other materials."
            : "Artisans and trade contacts for site work."}
        </p>
        {canManage ? (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background"
          >
            <Plus className="h-3.5 w-3.5" /> Add {kind === "SUPPLIER" ? "supplier" : "artisan"}
          </button>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-lg border border-foreground/10">
        <div className="divide-y divide-foreground/10">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {row.name}
                  {!row.isActive ? <span className="ml-2 text-[10px] uppercase text-muted">Archived</span> : null}
                </p>
                <p className="text-xs text-muted">
                  {[row.specialty, row.phone, row.email].filter(Boolean).join(" · ") || "No contact details"}
                </p>
                {row.address ? <p className="mt-1 text-[11px] text-muted">{row.address}</p> : null}
              </div>
              {canManage ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void onToggle(row.id, !row.isActive)}
                  className="rounded-md border border-foreground/15 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {row.isActive ? "Archive" : "Reactivate"}
                </button>
              ) : null}
            </div>
          ))}
          {!rows.length ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No {kind === "SUPPLIER" ? "suppliers" : "artisans"} yet.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
