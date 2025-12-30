import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { prisma } from "@/lib/prisma";

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

type ShellUserInfo = {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

type ActiveOrgLite = {
  id: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  organizationKind?: string | null;
  organizationCategory?: string | null;
};

export type OrganizerShellData = {
  userInfo: ShellUserInfo | null;
  orgOptions: OrganizationSwitcherOption[];
  activeOrgLite: ActiveOrgLite | null;
  brandPrimary?: string;
  brandSecondary?: string;
  organizerUsername?: string | null;
  organizerLanguage: string;
};

export async function getOrganizerShellData(): Promise<OrganizerShellData | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let currentId: number | null = null;
  let orgOptions: OrganizationSwitcherOption[] = [];
  let activeOrganizer: OrganizationSwitcherOption["organizer"] | null = null;
  let profile: { fullName: string | null; username: string | null; avatarUrl: string | null } | null = null;

  try {
    profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { fullName: true, username: true, avatarUrl: true },
    });
  } catch {
    profile = null;
  }

  try {
    const { organizer, membership } = await getActiveOrganizerForUser(user.id);
    currentId = organizer?.id ?? null;
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

  const organizerName =
    activeOrganizer?.publicName || activeOrganizer?.businessName || "Organizador";
  const organizerAvatarUrl = activeOrganizer?.brandingAvatarUrl ?? null;
  const organizerUsername = activeOrganizer?.username ?? null;
  const brandPrimary = activeOrganizer?.brandingPrimaryColor ?? undefined;
  const brandSecondary = activeOrganizer?.brandingSecondaryColor ?? undefined;
  const organizerLanguage = activeOrganizer?.language ?? "pt";

  const userInfo: ShellUserInfo = {
    id: user.id,
    name: profile?.fullName || profile?.username || user.email || null,
    email: user.email ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
  };

  const activeOrgLite = activeOrganizer
    ? {
        id: activeOrganizer.id,
        name: organizerName,
        username: organizerUsername,
        avatarUrl: organizerAvatarUrl,
        organizationKind: activeOrganizer.organizationKind ?? null,
        organizationCategory: activeOrganizer.organizationCategory ?? null,
      }
    : currentId
      ? {
          id: currentId,
          name: organizerName,
          username: organizerUsername ?? null,
          avatarUrl: organizerAvatarUrl,
          organizationKind: null,
          organizationCategory: null,
        }
      : null;

  return {
    userInfo,
    orgOptions,
    activeOrgLite,
    brandPrimary,
    brandSecondary,
    organizerUsername,
    organizerLanguage,
  };
}
