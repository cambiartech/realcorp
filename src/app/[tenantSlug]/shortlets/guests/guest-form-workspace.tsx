"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";
import { getShortletGuestUploadSignature, saveShortletGuest } from "../actions";

const ID_TYPES = ["National ID", "Driver's License", "International Passport", "Voter's Card", "Other"];

type GuestFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  guestType: "INDIVIDUAL" | "CORPORATE";
  idType: string;
  idNumber: string;
  idDocumentUrl: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  notes: string;
};

type Props = {
  tenantSlug: string;
  mode: "create" | "edit";
  guestId?: string;
  initial?: Partial<GuestFormData>;
  returnTo?: string;
};

const EMPTY: GuestFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  guestType: "INDIVIDUAL",
  idType: "National ID",
  idNumber: "",
  idDocumentUrl: "",
  addressLine: "",
  city: "",
  state: "",
  country: "Nigeria",
  notes: "",
};

export function GuestFormWorkspace({ tenantSlug, mode, guestId, initial, returnTo }: Props) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<GuestFormData>({ ...EMPTY, ...initial });

  const backHref = returnTo || `/${tenantSlug}/shortlets/guests`;

  async function handleIdUpload(file: File) {
    setUploading(true);
    const sig = await getShortletGuestUploadSignature(tenantSlug, { fileName: file.name });
    if (!sig.ok) {
      showSnackbar(sig.error, "error");
      setUploading(false);
      return;
    }
    const uploaded = await uploadViaCloudinarySignature(file, sig);
    setUploading(false);
    if (!uploaded.ok) {
      showSnackbar(uploaded.error, "error");
      return;
    }
    setForm((f) => ({ ...f, idDocumentUrl: uploaded.secureUrl }));
    showSnackbar("ID document uploaded.", "success");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveShortletGuest(tenantSlug, {
        id: guestId,
        ...form,
      });
      if (!res.ok) {
        showSnackbar(res.error || "Could not save guest.", "error");
        return;
      }
      showSnackbar(mode === "create" ? "Guest created." : "Guest updated.", "success");
      if (returnTo && res.guestId) {
        const sep = returnTo.includes("?") ? "&" : "?";
        router.push(`${returnTo}${sep}guestId=${encodeURIComponent(res.guestId)}`);
      } else {
        router.push(`/${tenantSlug}/shortlets/guests`);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={backHref} className="text-sm text-muted hover:text-foreground">
          ← Back
        </Link>
        <h2 className="mt-2 text-xl font-bold">{mode === "create" ? "Add guest" : "Edit guest"}</h2>
        <p className="mt-1 text-sm text-muted">
          Short-let guest profile — separate from sales clients. Reusable for repeat bookings and future
          marketplace listings.
        </p>
      </div>

      <form className="grid gap-6 lg:grid-cols-3" onSubmit={submit}>
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-foreground/10 p-4">
            <h3 className="font-semibold">Personal information</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-muted">
                First name *
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </label>
              <label className="block text-sm text-muted">
                Last name
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                />
              </label>
              <label className="block text-sm text-muted">
                Email
                <input
                  type="email"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label className="block text-sm text-muted">
                Phone
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="+234 xxx xxx xxxx"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-foreground/10 p-4">
            <h3 className="font-semibold">Identification (KYC)</h3>
            <p className="mt-1 text-xs text-muted">
              Optional — useful for check-in compliance and damage claims.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-muted">
                ID type
                <UiSelect
                  className="mt-1"
                  value={form.idType}
                  onChange={(e) => setForm((f) => ({ ...f, idType: e.target.value }))}
                >
                  {ID_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </UiSelect>
              </label>
              <label className="block text-sm text-muted">
                ID number
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={form.idNumber}
                  onChange={(e) => setForm((f) => ({ ...f, idNumber: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted">ID document</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-md border border-foreground/15 px-3 py-2 text-sm hover:bg-foreground/[0.03]">
                  {uploading ? "Uploading…" : "Choose file"}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    disabled={uploading || isPending}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleIdUpload(file);
                    }}
                  />
                </label>
                {form.idDocumentUrl ? (
                  <a href={form.idDocumentUrl} target="_blank" rel="noreferrer" className="text-sm underline">
                    View uploaded ID
                  </a>
                ) : (
                  <span className="text-xs text-muted">JPG, PNG, or PDF (max 5MB)</span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-foreground/10 p-4">
            <h3 className="font-semibold">Address</h3>
            <div className="mt-4 space-y-3">
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={2}
                placeholder="Street address"
                value={form.addressLine}
                onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  className="rounded-md border px-3 py-2 text-sm"
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
                <input
                  className="rounded-md border px-3 py-2 text-sm"
                  placeholder="State"
                  value={form.state}
                  onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                />
                <input
                  className="rounded-md border px-3 py-2 text-sm"
                  placeholder="Country"
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-foreground/10 p-4">
            <label className="block text-sm text-muted">
              Guest type
              <UiSelect
                className="mt-1"
                value={form.guestType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, guestType: e.target.value as GuestFormData["guestType"] }))
                }
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="CORPORATE">Corporate</option>
              </UiSelect>
            </label>
            <textarea
              className="mt-3 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
              placeholder="Internal notes (optional)"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </section>
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={isPending || uploading}
              className="rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
            >
              {mode === "create" ? "Create guest" : "Save changes"}
            </button>
            <Link href={backHref} className="text-center text-sm text-muted hover:text-foreground">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
