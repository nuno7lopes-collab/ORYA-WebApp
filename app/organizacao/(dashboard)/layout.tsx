export const runtime = "nodejs";

import type { ReactNode, CSSProperties } from "react";
import OrganizationDashboardShell from "../OrganizationDashboardShell";
import { getCurrentUser } from "@/lib/supabaseServer";
import {
  getActiveOrganizationForUser,
  ORG_CONTEXT_UI,
} from "@/lib/organizationContext";
import { prisma } from "@/lib/prisma";
import { OrganizationLangSetter } from "../OrganizationLangSetter";
import { OrganizationStatus } from "@prisma/client";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import { getPlatformOfficialEmail } from "@/lib/platformSettings";

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
    primaryModule?: string | null;
    status: string | null;
    brandingAvatarUrl?: string | null;
    brandingPrimaryColor?: string | null;
    brandingSecondaryColor?: string | null;
    language?: string | null;
    officialEmail?: string | null;
    officialEmailVerifiedAt?: Date | null;
  };
};

/**
 * Layout do dashboard da organização com shell principal.
 * Não contém lógica de autenticação; isso é tratado no layout pai /organizacao.
 * Busca o organization ativo no server para alimentar o switcher e reduzir fetches client.
 */
export default async function OrganizationDashboardLayout({ children }: { children: ReactNode }) {
  const { user } = await getCurrentUser();

  let orgOptions: OrganizationSwitcherOption[] = [];
  let activeOrganization: OrganizationSwitcherOption["organization"] | null = null;
  let activeRole: string | null = null;
  let activeModules: string[] = [];
  let profile:
    | { fullName: string | null; username: string | null; avatarUrl: string | null; updatedAt: Date | null }
    | null = null;

  if (user) {
    const profilePromise = prisma.profile.findUnique({
      where: { id: user.id },
      select: { fullName: true, username: true, avatarUrl: true, updatedAt: true },
    });
    const activeOrgPromise = getActiveOrganizationForUser(user.id, {
      ...ORG_CONTEXT_UI,
      includeOrganizationFields: "settings",
    });
    const membershipsPromise = prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
    });

    const [profileResult, activeOrgResult, membershipsResult] = await Promise.allSettled([
      profilePromise,
      activeOrgPromise,
      membershipsPromise,
    ]);

    profile = profileResult.status === "fulfilled" ? profileResult.value : null;

    if (activeOrgResult.status === "fulfilled") {
      const { organization, membership } = activeOrgResult.value;
      if (organization && membership) {
        activeOrganization = {
          id: organization.id,
          publicName: organization.publicName ?? null,
          businessName: organization.businessName ?? null,
          username: (organization as { username?: string | null }).username ?? null,
          brandingAvatarUrl: (organization as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? null,
          brandingPrimaryColor: (organization as { brandingPrimaryColor?: string | null }).brandingPrimaryColor ?? null,
          brandingSecondaryColor: (organization as { brandingSecondaryColor?: string | null }).brandingSecondaryColor ?? null,
          organizationKind: (organization as { organizationKind?: string | null }).organizationKind ?? null,
          primaryModule: (organization as { primaryModule?: string | null }).primaryModule ?? null,
          city: (organization as { city?: string | null }).city ?? null,
          entityType: (organization as { entityType?: string | null }).entityType ?? null,
          status: organization.status ?? null,
          language: (organization as { language?: string | null }).language ?? null,
          officialEmail: (organization as { officialEmail?: string | null }).officialEmail ?? null,
          officialEmailVerifiedAt: (organization as { officialEmailVerifiedAt?: Date | null }).officialEmailVerifiedAt ?? null,
        };
        activeRole = membership.role ?? null;
      }
    }

    if (activeOrganization) {
      try {
        const modulesRows = await prisma.organizationModuleEntry.findMany({
          where: { organizationId: activeOrganization.id, enabled: true },
          select: { moduleKey: true },
          orderBy: { moduleKey: "asc" },
        });
        activeModules = modulesRows.map((row) => row.moduleKey);
      } catch {
        activeModules = [];
      }
    }

    if (membershipsResult.status === "fulfilled") {
      orgOptions = membershipsResult.value
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
            primaryModule: (m.organization as { primaryModule?: string | null }).primaryModule ?? null,
            status: m.organization!.status,
            brandingAvatarUrl: (m.organization as { brandingAvatarUrl?: string | null }).brandingAvatarUrl ?? null,
            brandingPrimaryColor: (m.organization as { brandingPrimaryColor?: string | null }).brandingPrimaryColor ?? null,
            brandingSecondaryColor: (m.organization as { brandingSecondaryColor?: string | null }).brandingSecondaryColor ?? null,
            language: (m.organization as { language?: string | null }).language ?? null,
            officialEmail: (m.organization as { officialEmail?: string | null }).officialEmail ?? null,
            officialEmailVerifiedAt: (m.organization as { officialEmailVerifiedAt?: Date | null }).officialEmailVerifiedAt ?? null,
          },
        }));
    } else {
      const msg =
        typeof membershipsResult.reason === "object" &&
        membershipsResult.reason &&
        "message" in membershipsResult.reason
          ? String((membershipsResult.reason as { message?: unknown }).message)
          : "";
      if (!(msg.includes("does not exist") || msg.includes("organization_members"))) {
        throw membershipsResult.reason;
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
  const isSuspended = activeOrganization?.status === OrganizationStatus.SUSPENDED;
  const officialEmail = (activeOrganization as { officialEmail?: string | null })?.officialEmail ?? null;
  const officialEmailVerifiedAt =
    (activeOrganization as { officialEmailVerifiedAt?: Date | null })?.officialEmailVerifiedAt ?? null;
  const officialEmailNormalized = normalizeOfficialEmail(officialEmail);
  const isEmailVerified = Boolean(officialEmailNormalized && officialEmailVerifiedAt);
  const platformOfficialEmail = await getPlatformOfficialEmail();

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
        primaryModule: activeOrganization.primaryModule ?? null,
        modules: activeModules,
      }
    : null;

  return (
    <div
      className="flex min-h-screen w-full flex-col text-white"
      style={
        {
          "--brand-primary": brandPrimary,
          "--brand-secondary": brandSecondary,
        } as CSSProperties
      }
    >
      <OrganizationLangSetter language={organizationLanguage} />
      {activeOrganization?.id ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `try{sessionStorage.setItem("orya_last_organization_id","${activeOrganization.id}");${
              organizationUsername ? `sessionStorage.setItem("orya_last_organization_username","${organizationUsername}");` : ""
            }}catch(e){}`,
          }}
        />
      ) : null}
      <OrganizationDashboardShell
        activeOrg={activeOrgLite}
        orgOptions={orgOptions}
        user={userInfo}
        role={activeRole}
        isSuspended={isSuspended}
        emailVerification={activeOrganization ? { isVerified: isEmailVerified, email: officialEmailNormalized } : null}
        platformOfficialEmail={platformOfficialEmail}
      >
        {children}
      </OrganizationDashboardShell>
    </div>
  );
}
