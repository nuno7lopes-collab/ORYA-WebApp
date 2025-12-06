export const runtime = "nodejs";

import { ReactNode } from "react";
import Link from "next/link";
import { OrganizerSidebar } from "../OrganizerSidebar";
import { OrganizationSwitcher, type OrganizationSwitcherOption } from "../OrganizationSwitcher";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { prisma } from "@/lib/prisma";

/**
 * Layout do dashboard do organizador (sidebar + topbar).
 * Não contém lógica de autenticação; isso é tratado no layout pai /organizador.
 * Busca o organizer ativo no server para alimentar o switcher e reduzir fetches client.
 */
export default async function OrganizerDashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentId: number | null = null;
  let orgOptions: OrganizationSwitcherOption[] = [];
  if (user) {
    try {
      const { organizer } = await getActiveOrganizerForUser(user.id);
      currentId = organizer?.id ?? null;
    } catch {
      currentId = null;
    }

    try {
      const memberships = await prisma.organizerMember.findMany({
        where: { userId: user.id },
        include: { organizer: true },
        orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
      });

      orgOptions = memberships
        .filter((m) => m.organizer)
        .map((m) => ({
          organizerId: m.organizerId,
          role: m.role,
          organizer: {
            id: m.organizer!.id,
            username: m.organizer!.username,
            displayName: m.organizer!.displayName,
            businessName: m.organizer!.businessName,
            city: m.organizer!.city,
            entityType: m.organizer!.entityType,
            status: m.organizer!.status,
          },
        }));
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err && "message" in err ? String((err as { message?: unknown }).message) : "";
      if (!(msg.includes("does not exist") || msg.includes("organizer_members"))) {
        throw err;
      }
    }
  }

  const organizerName = "Organizador";
  const stripeState = { label: "Stripe", tone: "neutral" as const };

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
              <OrganizationSwitcher currentId={currentId} initialOrgs={orgOptions} />
              <Link
                href="/organizador/(dashboard)/organizations"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
              >
                Gerir organizações
              </Link>
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

        <main className="flex-1 pb-0 pt-0">{children}</main>
      </div>
    </div>
  );
}
