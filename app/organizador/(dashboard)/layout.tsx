export const runtime = "nodejs";

import { ReactNode } from "react";
import Link from "next/link";
import { OrganizerSidebar } from "../OrganizerSidebar";
import { OrganizationSwitcher, type OrganizationSwitcherOption } from "../OrganizationSwitcher";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { prisma } from "@/lib/prisma";
import { OrganizerLangSetter } from "../OrganizerLangSetter";
import { featureFlags } from "@/lib/flags";
import { OrganizerTourTrigger } from "../OrganizerTourTrigger";

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
  let activeOrganizer: {
    id: number;
    displayName: string | null;
    publicName?: string | null;
    businessName: string | null;
    username: string | null;
    brandingAvatarUrl?: string | null;
    brandingPrimaryColor?: string | null;
    brandingSecondaryColor?: string | null;
    language?: string | null;
  } | null = null;
  if (user) {
    try {
      const { organizer } = await getActiveOrganizerForUser(user.id);
      currentId = organizer?.id ?? null;
      if (organizer) {
        activeOrganizer = {
          id: organizer.id,
          displayName: organizer.displayName,
          publicName: (organizer as { publicName?: string | null }).publicName ?? null,
          businessName: organizer.businessName,
          username: (organizer as { username?: string | null }).username ?? null,
          brandingAvatarUrl: (organizer as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? null,
          brandingPrimaryColor: (organizer as { brandingPrimaryColor?: string | null }).brandingPrimaryColor ?? null,
          brandingSecondaryColor: (organizer as { brandingSecondaryColor?: string | null }).brandingSecondaryColor ?? null,
          language: (organizer as { language?: string | null }).language ?? null,
        };
      }
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
              publicName: (m.organizer as { publicName?: string | null }).publicName ?? null,
              businessName: m.organizer!.businessName,
              city: m.organizer!.city,
              entityType: m.organizer!.entityType,
              status: m.organizer!.status,
              brandingAvatarUrl: (m.organizer as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? null,
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

  const organizerName =
    activeOrganizer?.publicName || activeOrganizer?.displayName || activeOrganizer?.businessName || "Organizador";
  const organizerAvatarUrl = activeOrganizer?.brandingAvatarUrl ?? null;
  const organizerUsername = activeOrganizer?.username ?? null;
  const brandPrimary = activeOrganizer?.brandingPrimaryColor ?? undefined;
  const brandSecondary = activeOrganizer?.brandingSecondaryColor ?? undefined;
  const organizerLanguage = activeOrganizer?.language ?? "pt";
  const stripeState = { label: "Stripe", tone: "neutral" as const };

  return (
    <div
      className="orya-body-bg h-screen text-white flex overflow-hidden"
      style={
        {
          "--brand-primary": brandPrimary,
          "--brand-secondary": brandSecondary,
        } as React.CSSProperties
      }
    >
      <OrganizerLangSetter language={organizerLanguage} />
      <OrganizerSidebar organizerName={organizerName} organizerAvatarUrl={organizerAvatarUrl} />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050915]/80 px-4 py-3 backdrop-blur-xl md:px-6 lg:px-8 shrink-0">
          <div className="flex items-center justify-end gap-3">
            <div className="flex items-center gap-2 text-[11px]">
              <Link
                href="/explorar"
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
                data-tour="user-experience"
              >
                Voltar à experiência de utilizador
              </Link>
              {featureFlags.NEW_NAVBAR() && <OrganizerTourTrigger />}
              <OrganizationSwitcher currentId={currentId} initialOrgs={orgOptions} />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-0 pt-0 min-h-0">{children}</main>
      </div>
    </div>
  );
}
