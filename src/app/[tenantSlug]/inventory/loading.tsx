export default function InventoryLoading() {
  return (
    <div className="animate-pulse space-y-4 py-2">
      <div className="h-8 w-48 rounded bg-foreground/10" />
      <div className="h-4 w-96 max-w-full rounded bg-foreground/10" />
      <div className="h-10 w-full rounded bg-foreground/10" />
      <div className="h-64 w-full rounded bg-foreground/10" />
    </div>
  );
}
