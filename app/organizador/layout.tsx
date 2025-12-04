import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizerSidebar } from "./OrganizerSidebar";
import Link from "next/link";

export default async function OrganizerLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/organizador");
  }

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { fullName: true, username: true },
  });

  const organizer = await prisma.organizer.findFirst({
    where: { userId: user.id },
    select: {
      displayName: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
  });

  const organizerName = organizer?.displayName || profile?.fullName || profile?.username || "Organizador";
  const stripeState = organizer?.stripeAccountId
    ? organizer.stripeChargesEnabled && organizer.stripePayoutsEnabled
      ? { label: "Stripe ativo", tone: "success" }
      : { label: "Stripe incompleto", tone: "warning" }
    : { label: "Stripe por ligar", tone: "neutral" };

  return (
    <div className="orya-body-bg min-h-screen text-white flex">
      <OrganizerSidebar />

      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050915]/80 px-4 py-3 backdrop-blur-xl md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/60">Dashboard de organizador</p>
              <p className="text-sm font-semibold text-white">{organizerName}</p>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span
                className={`rounded-full border px-3 py-1 ${
                  stripeState.tone === "success"
                    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                    : stripeState.tone === "warning"
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
                    : "border-white/20 bg-white/10 text-white/70"
                }`}
              >
                {stripeState.label}
              </span>
              <Link
                href="/explorar"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
              >
                Voltar à experiência de utilizador
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 pb-0 pt-0">{children}</main>
      </div>
    </div>
  );
}
