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
        Paste the number from a &quot;This page could not load&quot; screen (for example{" "}
        <code className="font-mono text-xs">1520750018</code>) to see tenant, route, message, and stack trace.
      </p>
      <ErrorReferenceLookup className="mt-6" />
    </div>
  );
}
