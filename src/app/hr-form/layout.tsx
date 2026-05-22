export const metadata = {
  title: "HR Form",
  description: "Complete your employee form",
};

export default function HrFormPublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>;
}
