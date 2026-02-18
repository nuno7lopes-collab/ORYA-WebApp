import { DASHBOARD_SKELETON } from "@/app/org/_internal/core/dashboardUi";
import { cn } from "@/lib/utils";

export default function OrgHubOrganizationsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 text-white md:px-6 md:py-12 lg:px-8">
      <section className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className={cn(DASHBOARD_SKELETON, "h-7 w-52 rounded-full")} />
        <div className={cn(DASHBOARD_SKELETON, "mt-4 h-10 w-[min(520px,90%)] rounded-2xl")} />
        <div className={cn(DASHBOARD_SKELETON, "mt-2 h-5 w-[min(640px,92%)] rounded-full")} />

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={`org-hub-metric-${index}`} className={cn(DASHBOARD_SKELETON, "h-16 rounded-2xl")} />
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`org-hub-card-${index}`}
            className={cn(DASHBOARD_SKELETON, "h-[214px] rounded-3xl shadow-[0_16px_60px_rgba(0,0,0,0.45)]")}
          />
        ))}
      </section>
    </div>
  );
}

