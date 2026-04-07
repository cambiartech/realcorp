export default function RealtorPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-stone-100 to-stone-200 text-stone-900 dark:from-stone-950 dark:to-stone-900 dark:text-stone-100">
      {children}
    </div>
  );
}
