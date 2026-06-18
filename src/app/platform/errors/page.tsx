import { ErrorReferenceLookup } from "../error-reference-lookup";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Error lookup · Platform · Realcorp",
};

export default function PlatformErrorsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-foreground">Error reference lookup</h1>
      <p className="mt-1 text-sm text-muted">
        Paste the number from a &quot;This page could not load&quot; screen. The lookup shows the{" "}
        <strong className="font-medium text-foreground">server-side</strong> message and stack when available — not the generic text users see in the browser.
      </p>
      <ErrorReferenceLookup className="mt-6" />
    </div>
  );
}
