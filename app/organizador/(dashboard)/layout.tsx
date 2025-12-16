export const runtime = "nodejs";

import { ReactNode, CSSProperties } from "react";
import Link from "next/link";
import { OrganizerSidebar } from "../OrganizerSidebar";
import { OrganizationSwitcher, type OrganizationSwitcherOption } from "../OrganizationSwitcher";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { prisma } from "@/lib/prisma";
import { OrganizerLangSetter } from "../OrganizerLangSetter";
import { featureFlags } from "@/lib/flags";
import { OrganizerTourTrigger } from "../OrganizerTourTrigger";
import { RoleBadge } from "../RoleBadge";
import { DASHBOARD_LABEL, DASHBOARD_SHELL_PADDING } from "../dashboardUi";

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
  let activeRole: string | null = null;
  if (user) {
    try {
      const { organizer, membership } = await getActiveOrganizerForUser(user.id);
      currentId = organizer?.id ?? null;
      if (organizer && membership) {
        activeRole = membership.role;
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

  return (
    <div
      className="orya-body-bg h-screen text-white flex overflow-hidden"
      style={
        {
          "--brand-primary": brandPrimary,
          "--brand-secondary": brandSecondary,
        } as CSSProperties
      }
    >
      <OrganizerLangSetter language={organizerLanguage} />
      <OrganizerSidebar organizerName={organizerName} organizerAvatarUrl={organizerAvatarUrl} />

      <div className="flex-1 flex flex-col min-h-0">
        {/* Top bar */}
        <header className={`sticky top-0 z-30 border-b border-white/10 bg-[#050915]/85 backdrop-blur-xl ${DASHBOARD_SHELL_PADDING} py-3 shrink-0`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1224] shadow-[0_10px_40px_rgba(0,0,0,0.4)]">
                {organizerAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={organizerAvatarUrl} alt={organizerName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-black tracking-[0.22em] text-[#6BFFFF]">
                    OY
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className={DASHBOARD_LABEL}>Organização</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-white">{organizerName}</span>
                  {activeRole && <RoleBadge role={activeRole as any} />}
                </div>
                {organizerUsername && (
                  <p className="text-[12px] text-white/55">@{organizerUsername}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 text-[12px]">
              <Link
                href="/organizador/eventos/novo"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:scale-[1.01]"
              >
                Criar evento
              </Link>
              <Link
                href={organizerUsername ? `/o/${organizerUsername}` : "/explorar"}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
                data-tour="user-experience"
              >
                Ver página pública
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
