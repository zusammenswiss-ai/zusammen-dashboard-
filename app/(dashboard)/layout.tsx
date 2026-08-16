import Nav from "@/components/Nav";
import ConfigBanner from "@/components/ConfigBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Nav />
      <div className="flex min-w-0 flex-1 flex-col">
        <ConfigBanner />
        <main className="flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
