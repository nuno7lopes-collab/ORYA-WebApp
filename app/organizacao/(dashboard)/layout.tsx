export const runtime = "nodejs";

import type { ReactNode, CSSProperties } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { prisma } from "@/lib/prisma";
import { OrganizationLangSetter } from "../OrganizationLangSetter";
import { OrganizationBreadcrumb } from "../OrganizationBreadcrumb";

type OrganizationSwitcherOption = {
  organizationId: number;
  role: string;
  organization: {
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
 * Layout do dashboard do organização (sidebar + topbar com shadcn-like shell).
 * Não contém lógica de autenticação; isso é tratado no layout pai /organizacao.
 * Busca o organization ativo no server para alimentar o switcher e reduzir fetches client.
 */
export default async function OrganizationDashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let orgOptions: OrganizationSwitcherOption[] = [];
  let activeOrganization: OrganizationSwitcherOption["organization"] | null = null;
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
      const { organization, membership } = await getActiveOrganizationForUser(user.id);
      if (organization && membership) {
        activeOrganization = {
          id: organization.id,
          publicName: organization.publicName,
          businessName: organization.businessName,
          username: (organization as { username?: string | null }).username ?? null,
          brandingAvatarUrl: (organization as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? null,
          brandingPrimaryColor: (organization as { brandingPrimaryColor?: string | null }).brandingPrimaryColor ?? null,
          brandingSecondaryColor: (organization as { brandingSecondaryColor?: string | null }).brandingSecondaryColor ?? null,
          organizationKind: (organization as { organizationKind?: string | null }).organizationKind ?? null,
          organizationCategory: (organization as { organizationCategory?: string | null }).organizationCategory ?? null,
          city: (organization as { city?: string | null }).city ?? null,
          entityType: (organization as { entityType?: string | null }).entityType ?? null,
          status: organization.status ?? null,
          language: (organization as { language?: string | null }).language ?? null,
        };
      }
    } catch {
    }

    try {
      const memberships = await prisma.organizationMember.findMany({
        where: { userId: user.id },
        include: { organization: true },
        orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
      });

      orgOptions = memberships
        .filter((m) => m.organization)
        .map((m) => ({
          organizationId: m.organizationId,
          role: m.role,
          organization: {
            id: m.organization!.id,
            username: m.organization!.username,
            publicName: m.organization!.publicName,
            businessName: m.organization!.businessName,
            city: m.organization!.city,
            entityType: m.organization!.entityType,
            organizationKind: (m.organization as { organizationKind?: string | null }).organizationKind ?? null,
            organizationCategory: (m.organization as { organizationCategory?: string | null }).organizationCategory ?? null,
            status: m.organization!.status,
            brandingAvatarUrl: (m.organization as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? null,
            brandingPrimaryColor: (m.organization as { brandingPrimaryColor?: string | null }).brandingPrimaryColor ?? null,
            brandingSecondaryColor: (m.organization as { brandingSecondaryColor?: string | null }).brandingSecondaryColor ?? null,
            language: (m.organization as { language?: string | null }).language ?? null,
          },
        }));
    } catch (err: unknown) {
      const msg =
        typeof err === "object" && err && "message" in err ? String((err as { message?: unknown }).message) : "";
      if (!(msg.includes("does not exist") || msg.includes("organization_members"))) {
        throw err;
      }
    }
  }

  const organizationName =
    activeOrganization?.publicName || activeOrganization?.businessName || "Organização";
  const organizationAvatarUrl = activeOrganization?.brandingAvatarUrl ?? null;
  const organizationUsername = activeOrganization?.username ?? null;
  const brandPrimary = activeOrganization?.brandingPrimaryColor ?? undefined;
  const brandSecondary = activeOrganization?.brandingSecondaryColor ?? undefined;
  const organizationLanguage = activeOrganization?.language ?? "pt";

  const userInfo = user
    ? {
        id: user.id,
        name: profile?.fullName || profile?.username || user.email || null,
        email: user.email ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        avatarUpdatedAt: profile?.updatedAt ? profile.updatedAt.getTime() : null,
      }
    : null;

  const activeOrgLite = activeOrganization
    ? {
        id: activeOrganization.id,
        name: organizationName,
        username: organizationUsername,
        avatarUrl: organizationAvatarUrl,
        organizationKind: activeOrganization.organizationKind ?? null,
        organizationCategory: activeOrganization.organizationCategory ?? null,
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
        <OrganizationLangSetter language={organizationLanguage} />
        {organizationUsername ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `try{sessionStorage.setItem("orya_last_organization_username","${organizationUsername}");}catch(e){}`,
            }}
          />
        ) : null}

        <AppSidebar activeOrg={activeOrgLite} orgOptions={orgOptions} user={userInfo} />

        <SidebarInset>
          {/* Header mobile (trigger + breadcrumb) */}
          <div className="sticky top-0 z-40 flex items-center gap-3 bg-[rgba(5,9,21,0.85)] px-4 py-3 backdrop-blur md:hidden">
            <SidebarTrigger />
            <OrganizationBreadcrumb />
          </div>
          {/* Header desktop (breadcrumb only) */}
          <div className="hidden lg:block mb-4">
            <div className="rounded-3xl border border-white/5 bg-[rgba(6,10,20,0.75)] backdrop-blur-xl px-4 py-3 md:px-6 md:py-4">
              <OrganizationBreadcrumb />
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
