"use client";

import { useState, useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG } from "@/lib/modal-panel";
import { UiSelect } from "@/components/ui-select";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";
import { completeShortletCheckoutInspection, getShortletGuestUploadSignature } from "../actions";

type InspectionRow = {
  id: string;
  unitName: string;
  guestName: string;
  bookingNumber: string | null;
  checkoutLabel: string;
  status: string;
  statusValue: string;
  cautionFeePaths: string | null;
  photoCount?: number;
};

type Props = {
  tenantSlug: string;
  canManage: boolean;
  awaiting: InspectionRow[];
  completed: InspectionRow[];
};

type InspectForm = {
  status: "PASSED" | "FAILED" | "WAIVED";
  condition: "GOOD" | "DAMAGES_FOUND" | "MAINTENANCE_REQUIRED";
  damageNotes: string;
  cautionDeduction: string;
  photoUrls: string[];
};

const EMPTY_FORM: InspectForm = {
  status: "PASSED",
  condition: "GOOD",
  damageNotes: "",
  cautionDeduction: "",
  photoUrls: [],
};

export function InspectionsWorkspace({ tenantSlug, canManage, awaiting, completed }: Props) {
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [form, setForm] = useState<InspectForm>(EMPTY_FORM);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, msg = "Saved.", onOk?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        showSnackbar(msg, "success");
        setInspectId(null);
        setForm(EMPTY_FORM);
        onOk?.();
      } else {
        showSnackbar(res.error || "Could not save.", "error");
      }
    });
  }

  async function handlePhotoUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploadingPhotos(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        showSnackbar(`${file.name} is not an image — skipped.`, "error");
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        showSnackbar(`${file.name} exceeds 5MB — skipped.`, "error");
        continue;
      }
      const sig = await getShortletGuestUploadSignature(tenantSlug, { fileName: file.name });
      if (!sig.ok) {
        showSnackbar(sig.error, "error");
        continue;
      }
      const result = await uploadViaCloudinarySignature(file, sig);
      if (result.ok) uploaded.push(result.secureUrl);
      else showSnackbar(result.error, "error");
    }
    if (uploaded.length > 0) {
      setForm((f) => ({ ...f, photoUrls: [...f.photoUrls, ...uploaded] }));
      showSnackbar(`${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} added.`, "success");
    }
    setUploadingPhotos(false);
  }

  function removePhoto(url: string) {
    setForm((f) => ({ ...f, photoUrls: f.photoUrls.filter((p) => p !== url) }));
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-semibold">Awaiting inspection</h2>
        <p className="mt-1 text-sm text-muted">
          Created when a guest checks out. Inspect the room for damage, then stewards can clean and mark the room board clean.
        </p>
        {awaiting.length === 0 ? (
          <p className="mt-4 rounded-lg border border-foreground/10 p-4 text-sm text-muted">No rooms waiting for checkout inspection.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-foreground/10">
            <table className="min-w-full text-sm">
              <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Booking</th>
                  <th className="px-4 py-3">Checked out</th>
                  <th className="px-4 py-3">Caution fee</th>
                  {canManage ? <th className="px-4 py-3">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {awaiting.map((row) => (
                  <tr key={row.id} className="border-t border-foreground/10">
                    <td className="px-4 py-3 font-medium">{row.unitName}</td>
                    <td className="px-4 py-3">{row.guestName}</td>
                    <td className="px-4 py-3">{row.bookingNumber || "—"}</td>
                    <td className="px-4 py-3">{row.checkoutLabel}</td>
                    <td className="px-4 py-3">{row.cautionFeePaths || "—"}</td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => {
                            setInspectId(row.id);
                            setForm(EMPTY_FORM);
                          }}
                          className="rounded border border-foreground/15 px-2 py-1 text-[11px] hover:bg-foreground/[0.06] disabled:opacity-50"
                        >
                          Inspect
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {completed.length > 0 ? (
        <section>
          <h2 className="font-semibold">Recently completed</h2>
          <div className="mt-4 overflow-x-auto rounded-lg border border-foreground/10">
            <table className="min-w-full text-sm">
              <thead className="bg-foreground/[0.03] text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Photos</th>
                  <th className="px-4 py-3">Checked out</th>
                </tr>
              </thead>
              <tbody>
                {completed.map((row) => (
                  <tr key={row.id} className="border-t border-foreground/10">
                    <td className="px-4 py-3 font-medium">{row.unitName}</td>
                    <td className="px-4 py-3">{row.guestName}</td>
                    <td className="px-4 py-3">{row.status}</td>
                    <td className="px-4 py-3">{row.photoCount ? `${row.photoCount} attached` : "—"}</td>
                    <td className="px-4 py-3">{row.checkoutLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {inspectId ? (
        <ModalOverlay open={Boolean(inspectId)} onClose={() => setInspectId(null)} panelClassName={MODAL_PANEL_LG}>
          <h2 className="text-lg font-bold">Complete checkout inspection</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () =>
                  completeShortletCheckoutInspection(tenantSlug, {
                    inspectionId: inspectId,
                    status: form.status,
                    condition: form.condition,
                    damageNotes: form.damageNotes || undefined,
                    cautionDeduction: form.cautionDeduction ? Number(form.cautionDeduction) : undefined,
                    photoUrls: form.photoUrls.length > 0 ? form.photoUrls : undefined,
                  }),
                "Inspection saved.",
              );
            }}
          >
            <label className="block text-sm text-muted">
              Result
              <UiSelect className="mt-1" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InspectForm["status"] }))}>
                <option value="PASSED">Passed — room OK, send to cleaning</option>
                <option value="FAILED">Failed — maintenance required</option>
                <option value="WAIVED">Waived — skip to cleaning</option>
              </UiSelect>
            </label>
            <label className="block text-sm text-muted">
              Room condition
              <UiSelect className="mt-1" value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value as InspectForm["condition"] }))}>
                <option value="GOOD">Good condition</option>
                <option value="DAMAGES_FOUND">Damages found</option>
                <option value="MAINTENANCE_REQUIRED">Maintenance required</option>
              </UiSelect>
            </label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Damage notes (optional)"
              rows={3}
              value={form.damageNotes}
              onChange={(e) => setForm((f) => ({ ...f, damageNotes: e.target.value }))}
            />
            <input
              type="number"
              min={0}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Caution fee deduction (if any)"
              value={form.cautionDeduction}
              onChange={(e) => setForm((f) => ({ ...f, cautionDeduction: e.target.value }))}
            />

            <div className="rounded-md border border-foreground/10 p-3">
              <p className="text-sm font-medium">Damage photos</p>
              <p className="mt-0.5 text-xs text-muted">Optional — upload multiple images to document damages.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-md border border-foreground/15 px-3 py-2 text-sm hover:bg-foreground/[0.03]">
                  {uploadingPhotos ? "Uploading…" : "Add photos"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    disabled={uploadingPhotos || isPending}
                    onChange={(e) => {
                      void handlePhotoUpload(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                {form.photoUrls.length > 0 ? (
                  <span className="text-xs text-muted">{form.photoUrls.length} photo{form.photoUrls.length === 1 ? "" : "s"} attached</span>
                ) : null}
              </div>
              {form.photoUrls.length > 0 ? (
                <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {form.photoUrls.map((url) => (
                    <li key={url} className="group relative aspect-square overflow-hidden rounded-md border border-foreground/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Damage evidence" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(url)}
                        className="absolute right-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] shadow opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setInspectId(null)} className="rounded-md border px-3 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={isPending || uploadingPhotos} className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-50">
                Save inspection
              </button>
            </div>
          </form>
        </ModalOverlay>
      ) : null}
    </div>
  );
}
