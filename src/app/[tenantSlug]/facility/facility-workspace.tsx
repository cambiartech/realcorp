"use client";

import {
  createFacilityAsset,
  createFacilityItem,
  getFacilityUploadSignature,
  logFacilityService,
  recordFacilityMovement,
  reportFacilityDamage,
  updateFacilityDamageStatus,
} from "@/app/[tenantSlug]/facility/actions";
import { FileDropZone } from "@/components/hr/file-drop-zone";
import { ModalOverlay } from "@/components/modal-overlay";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";
import { MODAL_PANEL_FORM, MODAL_PANEL_SM } from "@/lib/modal-panel";
import { InventoryItemClass } from "@/generated/prisma";
import { AlertTriangle, Plus, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type TabId = "overview" | "catalog" | "stock" | "usage" | "plant" | "damages";

const inputClass =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20";

function classLabel(value: string) {
  if (value === "MATERIAL") return "Material";
  if (value === "CONSUMABLE") return "Consumable";
  if (value === "EQUIPMENT") return "Plant / machine type";
  return "Tool";
}

function movementLabel(value: string) {
  if (value === "RECEIVE") return "Received";
  if (value === "TRANSFER") return "Transferred";
  if (value === "ISSUE") return "Used";
  if (value === "DAMAGE") return "Damaged";
  return "Adjusted";
}

export function FacilityWorkspace(props: {
  tenantSlug: string;
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
  }>;
  locations: Array<{
    id: string;
    name: string;
    kind: string;
    projectId: string;
    projectName: string;
  }>;
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
  movements: Array<{
    id: string;
    type: string;
    itemName: string;
    unitOfMeasure: string;
    quantity: number;
    fromName: string;
    toName: string;
    projectName: string;
    notes: string;
    recordedByLabel: string;
    createdAt: string;
    createdAtValue: string;
  }>;
  assets: Array<{
    id: string;
    name: string;
    serialNumber: string;
    status: string;
    itemName: string;
    projectName: string;
    lastServiceAt: string;
    nextServiceAt: string;
    nextServiceValue: string;
    overdue: boolean;
    serviceIntervalDays: number;
  }>;
  damages: Array<{
    id: string;
    status: string;
    description: string;
    itemName: string;
    assetName: string;
    projectName: string;
    quantity: number | null;
    estimatedCost: number | null;
    photoUrl: string;
    reportedByLabel: string;
    confirmedByLabel: string;
    createdAt: string;
  }>;
  projects: Array<{ id: string; name: string }>;
  units: Array<{ id: string; label: string; projectId: string }>;
  weekUsage: number;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState<TabId>("overview");
  const [pending, setPending] = useState(false);
  const [modal, setModal] = useState<"item" | "receive" | "issue" | "transfer" | "asset" | "service" | "damage" | null>(
    null,
  );
  const [serviceAssetId, setServiceAssetId] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [issueProjectId, setIssueProjectId] = useState("");

  const stockItems = props.items.filter((item) => item.itemClass !== "EQUIPMENT");
  const plantTypes = props.items.filter((item) => item.itemClass === "EQUIPMENT");
  const lowStock = props.balances.filter((row) => row.quantity <= row.reorderPoint && row.reorderPoint > 0);
  const overduePlant = props.assets.filter((asset) => asset.overdue);
  const openDamages = props.damages.filter((row) => row.status === "OPEN");
  const cement = props.items.find((item) => item.name.toLowerCase() === "cement");
  const cementOnHand = cement?.onHand ?? 0;
  const issueUnits = useMemo(
    () => props.units.filter((unit) => !issueProjectId || unit.projectId === issueProjectId),
    [issueProjectId, props.units],
  );

  async function finish(result: { ok: boolean; error?: string }, success: string) {
    if (!result.ok) {
      showSnackbar(result.error || "Could not complete the action.", "error");
      return false;
    }
    showSnackbar(success, "success");
    setModal(null);
    setEvidenceFile(null);
    router.refresh();
    return true;
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "catalog", label: "Catalog" },
    { id: "stock", label: "Stock" },
    { id: "usage", label: "Usage" },
    { id: "plant", label: "Plant" },
    { id: "damages", label: "Damages" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Workspace</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Facility</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Site stores, material usage, plant service dates, and damages — for Facility Managers and site teams.
          </p>
        </div>
        {props.canRecord ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setModal("issue")}
              className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-semibold"
            >
              Record usage
            </button>
            {props.canManage ? (
              <button
                type="button"
                onClick={() => setModal("receive")}
                className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background"
              >
                <Plus className="h-4 w-4" /> Receive stock
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-foreground/10">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              "border-b-2 px-4 py-2 text-sm font-medium",
              tab === item.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Cement on hand" value={`${cementOnHand}`} hint="bags across all stores" />
            <StatCard label="Used this week" value={`${props.weekUsage}`} hint="all issued materials" />
            <StatCard label="Low stock lines" value={`${lowStock.length}`} hint="at or below reorder point" />
            <StatCard label="Overdue services" value={`${overduePlant.length}`} hint="plant past next service date" />
          </div>
          {openDamages.length ? (
            <div className="rounded-lg border border-[var(--warn-line)] bg-[var(--warn-wash)] px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">{openDamages.length} open damage report{openDamages.length === 1 ? "" : "s"}</p>
              <p className="mt-1 text-xs text-muted">Confirm them on the Damages tab so stock and plant stay accurate.</p>
            </div>
          ) : null}
          {overduePlant.length ? (
            <div className="overflow-hidden rounded-lg border border-foreground/10">
              <p className="border-b border-foreground/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Plant due for service
              </p>
              <ul className="divide-y divide-foreground/10">
                {overduePlant.slice(0, 8).map((asset) => (
                  <li key={asset.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{asset.name}</p>
                      <p className="text-xs text-muted">Next service {asset.nextServiceAt || "not set"}</p>
                    </div>
                    {props.canRecord ? (
                      <button
                        type="button"
                        onClick={() => {
                          setServiceAssetId(asset.id);
                          setModal("service");
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-foreground/15 px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <Wrench className="h-3.5 w-3.5" /> Log service
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "catalog" ? (
        <Section
          title="Catalog"
          hint="Shared list of materials, consumables, and machine types."
          action={
            props.canManage ? (
              <button type="button" onClick={() => setModal("item")} className="rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background">
                New item
              </button>
            ) : null
          }
        >
          <SimpleTable
            empty="No catalog items yet."
            headers={["Item", "Class", "Unit", "On hand", "Reorder at"]}
            rows={props.items.map((item) => [
              <span key={`${item.id}-n`}>
                <span className="font-medium">{item.name}</span>
                {item.sku ? <span className="block text-xs text-muted">{item.sku}</span> : null}
              </span>,
              classLabel(item.itemClass),
              item.unitOfMeasure,
              String(item.onHand),
              String(item.reorderPoint),
            ])}
          />
        </Section>
      ) : null}

      {tab === "stock" ? (
        <Section
          title="Stock on hand"
          hint="Balances by store. Receive into central or a project store, then issue usage from the site."
          action={
            props.canManage ? (
              <button type="button" onClick={() => setModal("transfer")} className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold">
                Transfer
              </button>
            ) : null
          }
        >
          <SimpleTable
            empty="No stock on hand yet. Receive materials to get started."
            headers={["Item", "Store", "Quantity"]}
            rows={props.balances
              .filter((row) => row.quantity !== 0)
              .map((row) => [
                row.itemName,
                row.locationName,
                `${row.quantity} ${row.unitOfMeasure}`,
              ])}
          />
        </Section>
      ) : null}

      {tab === "usage" ? (
        <Section title="Usage" hint="Issues to a project or apartment — this is the cement and materials ledger.">
          <SimpleTable
            empty="No usage recorded yet."
            headers={["When", "Item", "Qty", "From", "Project", "By"]}
            rows={props.movements
              .filter((row) => row.type === "ISSUE")
              .map((row) => [
                row.createdAt,
                row.itemName,
                `${row.quantity} ${row.unitOfMeasure}`,
                row.fromName || "—",
                row.projectName || "—",
                row.recordedByLabel,
              ])}
          />
        </Section>
      ) : null}

      {tab === "plant" ? (
        <Section
          title="Plant and machinery"
          hint="Last service date and next service date for each machine."
          action={
            props.canManage ? (
              <button type="button" onClick={() => setModal("asset")} className="rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background">
                Register plant
              </button>
            ) : null
          }
        >
          <SimpleTable
            empty="No plant registered yet."
            headers={["Machine", "Status", "Site", "Last service", "Next service", ""]}
            rows={props.assets.map((asset) => [
              <span key={`${asset.id}-n`}>
                <span className="font-medium">{asset.name}</span>
                <span className="block text-xs text-muted">{asset.serialNumber || asset.itemName}</span>
              </span>,
              asset.status.replaceAll("_", " "),
              asset.projectName || "Unassigned",
              asset.lastServiceAt || "—",
              <span key={`${asset.id}-nxs`} className={asset.overdue ? "font-semibold text-[var(--danger)]" : ""}>
                {asset.nextServiceAt || "—"}
              </span>,
              props.canRecord ? (
                <button
                  key={`${asset.id}-a`}
                  type="button"
                  onClick={() => {
                    setServiceAssetId(asset.id);
                    setModal("service");
                  }}
                  className="text-xs font-semibold underline"
                >
                  Log service
                </button>
              ) : (
                ""
              ),
            ])}
          />
        </Section>
      ) : null}

      {tab === "damages" ? (
        <Section
          title="Damages"
          hint="Broken stock, damaged plant, or loss. A Facility Manager confirms the write-off."
          action={
            props.canRecord ? (
              <button type="button" onClick={() => setModal("damage")} className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold">
                <AlertTriangle className="h-3.5 w-3.5" /> Report damage
              </button>
            ) : null
          }
        >
          <SimpleTable
            empty="No damage reports."
            headers={["When", "What", "Project", "Status", "By", ""]}
            rows={props.damages.map((row) => [
              row.createdAt,
              <span key={`${row.id}-w`}>
                <span className="font-medium">{row.assetName || row.itemName || "Damage"}</span>
                <span className="block text-xs text-muted">{row.description}</span>
                {row.photoUrl ? (
                  <a href={row.photoUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold underline">
                    Photo
                  </a>
                ) : null}
              </span>,
              row.projectName || "—",
              row.status.replaceAll("_", " "),
              row.confirmedByLabel || row.reportedByLabel,
              props.canManage && row.status === "OPEN" ? (
                <button
                  key={`${row.id}-c`}
                  type="button"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await finish(
                        await updateFacilityDamageStatus(props.tenantSlug, {
                          damageId: row.id,
                          status: "CONFIRMED",
                        }),
                        "Damage confirmed.",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                  className="text-xs font-semibold underline"
                >
                  Confirm
                </button>
              ) : (
                ""
              ),
            ])}
          />
        </Section>
      ) : null}

      <ModalOverlay open={modal === "item"} onClose={() => setModal(null)} panelClassName={MODAL_PANEL_SM} aria-labelledby="facility-item-title">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setPending(true);
            try {
              await finish(await createFacilityItem(props.tenantSlug, data), "Catalog item added.");
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 id="facility-item-title" className="text-lg font-semibold">New catalog item</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm"><span className="mb-1 block text-xs">Name</span><input name="name" required className={inputClass} placeholder="Cement" /></label>
            <label className="text-sm"><span className="mb-1 block text-xs">SKU</span><input name="sku" className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs">Class</span>
              <UiSelect name="itemClass" defaultValue={InventoryItemClass.MATERIAL}>
                <option value="MATERIAL">Material</option>
                <option value="CONSUMABLE">Consumable</option>
                <option value="EQUIPMENT">Plant / machine type</option>
                <option value="TOOL">Tool</option>
              </UiSelect>
            </label>
            <label className="text-sm"><span className="mb-1 block text-xs">Unit of measure</span><input name="unitOfMeasure" defaultValue="bag" required className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs">Reorder point</span><input name="reorderPoint" type="number" min="0" defaultValue="0" className={inputClass} /></label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Saving…" : "Save item"}</button>
          </div>
        </form>
      </ModalOverlay>

      <MovementModal
        open={modal === "receive" || modal === "issue" || modal === "transfer"}
        title={modal === "receive" ? "Receive stock" : modal === "transfer" ? "Transfer stock" : "Record usage"}
        type={modal === "receive" ? "RECEIVE" : modal === "transfer" ? "TRANSFER" : "ISSUE"}
        pending={pending}
        items={stockItems}
        locations={props.locations}
        projects={props.projects}
        units={issueUnits}
        onProjectChange={setIssueProjectId}
        onClose={() => setModal(null)}
        onSubmit={async (payload) => {
          setPending(true);
          try {
            await finish(await recordFacilityMovement(props.tenantSlug, payload), "Stock movement saved.");
          } finally {
            setPending(false);
          }
        }}
      />

      <ModalOverlay open={modal === "asset"} onClose={() => setModal(null)} panelClassName={MODAL_PANEL_FORM} aria-labelledby="facility-asset-title">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setPending(true);
            try {
              await finish(await createFacilityAsset(props.tenantSlug, data), "Plant registered.");
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 id="facility-asset-title" className="text-lg font-semibold">Register plant</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2"><span className="mb-1 block text-xs">Machine name</span><input name="name" required className={inputClass} placeholder="Mixer — site 2" /></label>
            <label className="text-sm"><span className="mb-1 block text-xs">Type</span>
              <UiSelect name="itemId" required defaultValue={plantTypes[0]?.id || ""}>
                {plantTypes.length ? plantTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : <option value="">Add an equipment type in Catalog first</option>}
              </UiSelect>
            </label>
            <label className="text-sm"><span className="mb-1 block text-xs">Serial</span><input name="serialNumber" className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs">Assigned project</span>
              <UiSelect name="projectId" defaultValue="">
                <option value="">Unassigned</option>
                {props.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </UiSelect>
            </label>
            <label className="text-sm"><span className="mb-1 block text-xs">Status</span>
              <UiSelect name="status" defaultValue="AVAILABLE">
                <option value="AVAILABLE">Available</option>
                <option value="ON_SITE">On site</option>
                <option value="IN_SERVICE">In service</option>
              </UiSelect>
            </label>
            <label className="text-sm"><span className="mb-1 block text-xs">Last service</span><input type="date" name="lastServiceAt" className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs">Next service</span><input type="date" name="nextServiceAt" className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs">Service every (days)</span><input type="number" min="0" name="serviceIntervalDays" defaultValue="90" className={inputClass} /></label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={pending || !plantTypes.length} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Saving…" : "Save plant"}</button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay open={modal === "service"} onClose={() => setModal(null)} panelClassName={MODAL_PANEL_SM} aria-labelledby="facility-service-title">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            setPending(true);
            try {
              await finish(await logFacilityService(props.tenantSlug, { ...data, assetId: serviceAssetId }), "Service logged.");
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 id="facility-service-title" className="text-lg font-semibold">Log service</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm"><span className="mb-1 block text-xs">Service date</span><input type="date" name="servicedAt" required className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs">Next due (optional)</span><input type="date" name="nextDueAt" className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs">Notes</span><textarea name="notes" rows={3} className={inputClass} /></label>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Saving…" : "Save service"}</button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay open={modal === "damage"} onClose={() => setModal(null)} panelClassName={MODAL_PANEL_FORM} aria-labelledby="facility-damage-title">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            try {
              let photoUrl = "";
              if (evidenceFile) {
                const signature = await getFacilityUploadSignature(props.tenantSlug, evidenceFile.name);
                if (!signature.ok) {
                  showSnackbar(signature.error, "error");
                  return;
                }
                const upload = await uploadViaCloudinarySignature(evidenceFile, signature);
                if (!upload.ok) {
                  showSnackbar(upload.error, "error");
                  return;
                }
                photoUrl = upload.secureUrl;
              }
              const data = Object.fromEntries(new FormData(event.currentTarget));
              await finish(await reportFacilityDamage(props.tenantSlug, { ...data, photoUrl }), "Damage reported.");
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 id="facility-damage-title" className="text-lg font-semibold">Report damage</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block text-xs">Material</span>
              <UiSelect name="itemId" defaultValue="">
                <option value="">None</option>
                {stockItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </UiSelect>
            </label>
            <label className="text-sm"><span className="mb-1 block text-xs">Plant</span>
              <UiSelect name="assetId" defaultValue="">
                <option value="">None</option>
                {props.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
              </UiSelect>
            </label>
            <label className="text-sm"><span className="mb-1 block text-xs">Store</span>
              <UiSelect name="locationId" defaultValue="">
                <option value="">Not specified</option>
                {props.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
              </UiSelect>
            </label>
            <label className="text-sm"><span className="mb-1 block text-xs">Project</span>
              <UiSelect name="projectId" defaultValue="">
                <option value="">Not specified</option>
                {props.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </UiSelect>
            </label>
            <label className="text-sm"><span className="mb-1 block text-xs">Quantity</span><input type="number" min="0" step="0.01" name="quantity" className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs">Estimated cost</span><input type="number" min="0" name="estimatedCost" className={inputClass} /></label>
            <label className="text-sm sm:col-span-2"><span className="mb-1 block text-xs">What happened</span><textarea name="description" required rows={3} className={inputClass} /></label>
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs">Photo (optional)</p>
              <FileDropZone onFile={setEvidenceFile} uploading={pending} accept=".jpg,.jpeg,.png,.webp,.pdf" hint={evidenceFile ? evidenceFile.name : "Image or PDF"} />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setModal(null)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Saving…" : "Submit report"}</button>
          </div>
        </form>
      </ModalOverlay>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SimpleTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (!rows.length) {
    return <div className="rounded-lg border border-dashed border-foreground/20 p-8 text-center text-sm text-muted">{empty}</div>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-foreground/10">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
          <tr>
            {headers.map((header) => (
              <th key={header || "action"} className="px-3 py-2 font-semibold">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-foreground/10">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top text-foreground">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MovementModal({
  open,
  title,
  type,
  pending,
  items,
  locations,
  projects,
  units,
  onProjectChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  type: "RECEIVE" | "TRANSFER" | "ISSUE";
  pending: boolean;
  items: Array<{ id: string; name: string; unitOfMeasure: string }>;
  locations: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  units: Array<{ id: string; label: string }>;
  onProjectChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <ModalOverlay open={open} onClose={onClose} panelClassName={MODAL_PANEL_FORM} aria-labelledby="facility-move-title">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const data = Object.fromEntries(new FormData(event.currentTarget));
          await onSubmit({ ...data, type });
        }}
      >
        <h2 id="facility-move-title" className="text-lg font-semibold">{title}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2"><span className="mb-1 block text-xs">Item</span>
            <UiSelect name="itemId" required defaultValue={items[0]?.id || ""}>
              {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </UiSelect>
          </label>
          <label className="text-sm"><span className="mb-1 block text-xs">Quantity</span><input type="number" min="0.01" step="0.01" name="quantity" required className={inputClass} /></label>
          {type === "RECEIVE" ? (
            <label className="text-sm"><span className="mb-1 block text-xs">Into store</span>
              <UiSelect name="toLocationId" required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</UiSelect>
            </label>
          ) : null}
          {type === "TRANSFER" ? (
            <>
              <label className="text-sm"><span className="mb-1 block text-xs">From</span>
                <UiSelect name="fromLocationId" required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</UiSelect>
              </label>
              <label className="text-sm"><span className="mb-1 block text-xs">To</span>
                <UiSelect name="toLocationId" required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</UiSelect>
              </label>
            </>
          ) : null}
          {type === "ISSUE" ? (
            <>
              <label className="text-sm"><span className="mb-1 block text-xs">From store</span>
                <UiSelect name="fromLocationId" required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</UiSelect>
              </label>
              <label className="text-sm"><span className="mb-1 block text-xs">Project</span>
                <UiSelect name="projectId" defaultValue="" onChange={(event) => onProjectChange(event.target.value)}>
                  <option value="">Not specified</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </UiSelect>
              </label>
              <label className="text-sm"><span className="mb-1 block text-xs">Apartment / unit</span>
                <UiSelect name="unitId" defaultValue="">
                  <option value="">Not specified</option>
                  {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
                </UiSelect>
              </label>
            </>
          ) : null}
          <label className="text-sm sm:col-span-2"><span className="mb-1 block text-xs">Notes</span><input name="notes" className={inputClass} /></label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </ModalOverlay>
  );
}
