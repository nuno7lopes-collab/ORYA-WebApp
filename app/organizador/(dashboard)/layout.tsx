export const runtime = "nodejs";

import type { ReactNode, CSSProperties } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { prisma } from "@/lib/prisma";
import { OrganizerLangSetter } from "../OrganizerLangSetter";
import { OrganizerBreadcrumb } from "../OrganizerBreadcrumb";

type OrganizationSwitcherOption = {
  organizerId: number;
  role: string;
  organizer: {
    id: number;
    username: string | null;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    entityType: string | null;
    organizationKind?: string | null;
    organizationCategory?: string | null;
    status: string | null;
    brandingAvatarUrl?: string | null;
    brandingPrimaryColor?: string | null;
    brandingSecondaryColor?: string | null;
    language?: string | null;
  };
};

/**
 * Layout do dashboard do organizador (sidebar + topbar com shadcn-like shell).
 * Não contém lógica de autenticação; isso é tratado no layout pai /organizador.
 * Busca o organizer ativo no server para alimentar o switcher e reduzir fetches client.
 */
export default async function OrganizerDashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let orgOptions: OrganizationSwitcherOption[] = [];
  let activeOrganizer: OrganizationSwitcherOption["organizer"] | null = null;
  let profile:
    | { fullName: string | null; username: string | null; avatarUrl: string | null; updatedAt: Date | null }
    | null = null;

  if (user) {
    try {
      profile = await prisma.profile.findUnique({
        where: { id: user.id },
        select: { fullName: true, username: true, avatarUrl: true, updatedAt: true },
      });
    } catch {
      profile = null;
    }

    try {
      const { organizer, membership } = await getActiveOrganizerForUser(user.id);
      if (organizer && membership) {
        activeOrganizer = {
          id: organizer.id,
          publicName: organizer.publicName,
          businessName: organizer.businessName,
          username: (organizer as { username?: string | null }).username ?? null,
          brandingAvatarUrl: (organizer as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? null,
          brandingPrimaryColor: (organizer as { brandingPrimaryColor?: string | null }).brandingPrimaryColor ?? null,
          brandingSecondaryColor: (organizer as { brandingSecondaryColor?: string | null }).brandingSecondaryColor ?? null,
          organizationKind: (organizer as { organizationKind?: string | null }).organizationKind ?? null,
          organizationCategory: (organizer as { organizationCategory?: string | null }).organizationCategory ?? null,
          city: (organizer as { city?: string | null }).city ?? null,
          entityType: (organizer as { entityType?: string | null }).entityType ?? null,
          status: organizer.status ?? null,
          language: (organizer as { language?: string | null }).language ?? null,
        };
      }
    } catch {
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
            publicName: m.organizer!.publicName,
            businessName: m.organizer!.businessName,
            city: m.organizer!.city,
            entityType: m.organizer!.entityType,
            organizationKind: (m.organizer as { organizationKind?: string | null }).organizationKind ?? null,
            organizationCategory: (m.organizer as { organizationCategory?: string | null }).organizationCategory ?? null,
            status: m.organizer!.status,
            brandingAvatarUrl: (m.organizer as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? null,
            brandingPrimaryColor: (m.organizer as { brandingPrimaryColor?: string | null }).brandingPrimaryColor ?? null,
            brandingSecondaryColor: (m.organizer as { brandingSecondaryColor?: string | null }).brandingSecondaryColor ?? null,
            language: (m.organizer as { language?: string | null }).language ?? null,
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
    activeOrganizer?.publicName || activeOrganizer?.businessName || "Organizador";
  const organizerAvatarUrl = activeOrganizer?.brandingAvatarUrl ?? null;
  const organizerUsername = activeOrganizer?.username ?? null;
  const brandPrimary = activeOrganizer?.brandingPrimaryColor ?? undefined;
  const brandSecondary = activeOrganizer?.brandingSecondaryColor ?? undefined;
  const organizerLanguage = activeOrganizer?.language ?? "pt";

  const userInfo = user
    ? {
        id: user.id,
        name: profile?.fullName || profile?.username || user.email || null,
        email: user.email ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        avatarUpdatedAt: profile?.updatedAt ? profile.updatedAt.getTime() : null,
      }
    : null;

  const activeOrgLite = activeOrganizer
    ? {
        id: activeOrganizer.id,
        name: organizerName,
        username: organizerUsername,
        avatarUrl: organizerAvatarUrl,
        organizationKind: activeOrganizer.organizationKind ?? null,
        organizationCategory: activeOrganizer.organizationCategory ?? null,
      }
    : null;

  return (
    <SidebarProvider defaultOpen>
      <div
        className="text-white flex min-h-screen items-stretch"
        style={
          {
            "--brand-primary": brandPrimary,
            "--brand-secondary": brandSecondary,
          } as CSSProperties
        }
      >
        <OrganizerLangSetter language={organizerLanguage} />
        {organizerUsername ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `try{sessionStorage.setItem("orya_last_organizer_username","${organizerUsername}");}catch(e){}`,
            }}
          />
        ) : null}

        <AppSidebar activeOrg={activeOrgLite} orgOptions={orgOptions} user={userInfo} />

        <SidebarInset>
          {/* Header mobile (trigger + breadcrumb) */}
          <div className="sticky top-0 z-40 flex items-center gap-3 bg-[rgba(5,9,21,0.85)] px-4 py-3 backdrop-blur md:hidden">
            <SidebarTrigger />
            <OrganizerBreadcrumb />
          </div>
          {/* Header desktop (breadcrumb only) */}
          <div className="hidden lg:block mb-4">
            <div className="rounded-3xl border border-white/5 bg-[rgba(6,10,20,0.75)] backdrop-blur-xl px-4 py-3 md:px-6 md:py-4">
              <OrganizerBreadcrumb />
            </div>
          </div>
          <main className="relative min-h-0 flex-1 overflow-y-auto pb-0 pt-0">
            <div className="px-4 py-4 md:px-6 lg:px-8 lg:py-6">
              <div className="relative isolate overflow-hidden">{children}</div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
