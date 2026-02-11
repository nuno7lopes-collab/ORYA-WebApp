// app/api/auth/me/route.ts
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getNotificationPrefs } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import { setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";
import { normalizeProfileAvatarUrl } from "@/lib/profileMedia";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type SupabaseUserMetadata = {
  full_name?: string;
  name?: string;
  avatar_url?: string;
  pending_username?: string;
};

type ApiAuthMeResponse = {
  user: {
    id: string;
    email: string | null;
    emailConfirmed: boolean;
  } | null;
  profile: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
    updatedAt: string | Date | null;
    bio: string | null;
    isVerified: boolean;
    contactPhone: string | null;
    favouriteCategories: string[];
    onboardingDone: boolean;
    roles: string[];
    visibility: string;
    allowEmailNotifications: boolean;
    allowEventReminders: boolean;
    allowFollowRequests: boolean;
    allowSalesAlerts?: boolean;
    allowSystemAnnouncements?: boolean;
    allowMarketingCampaigns?: boolean;
    profileVisibility: "PUBLIC" | "PRIVATE" | "FOLLOWERS";
  } | null;
  needsEmailConfirmation?: boolean;
};

async function _GET() {
  try {
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      // Sessão ausente ou inválida → 401 limpo (evita spam de logs)
      return jsonWrap(
        { user: null, profile: null },
        { status: 401 },
      );
    }

    const supaUser = user as User;
    const emailConfirmed =
      Boolean(supaUser.email_confirmed_at) ||
      Boolean((supaUser as { confirmed_at?: string | null })?.confirmed_at) ||
      false;

    const userMetadata = (user.user_metadata ?? {}) as SupabaseUserMetadata;

    const userId = user.id;

    // Garantir Profile 1-1 com auth.users sem writes recorrentes no endpoint de leitura.
    const notificationPrefsPromise = getNotificationPrefs(userId).catch(() => null);
    let initialProfile = await prisma.profile.findUnique({ where: { id: userId } });
    if (!initialProfile) {
      try {
        initialProfile = await prisma.profile.create({
          data: {
            id: userId,
            username: null,
            fullName: userMetadata.full_name ?? userMetadata.name ?? null,
            avatarUrl: normalizeProfileAvatarUrl(userMetadata.avatar_url ?? null),
            roles: ["user"],
            visibility: "PUBLIC",
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          initialProfile = await prisma.profile.findUnique({ where: { id: userId } });
        } else {
          throw err;
        }
      }
    }
    if (!initialProfile) {
      throw new Error("PROFILE_INIT_FAILED");
    }
    const notificationPrefs = await notificationPrefsPromise;
    let profile = initialProfile;

    const pendingUsername = typeof userMetadata.pending_username === "string" ? userMetadata.pending_username : null;

    // Atribuir username pendente se ainda não existir
    if (!profile.username && pendingUsername) {
      try {
        await prisma.$transaction(async (tx) => {
          await setUsernameForOwner({
            username: pendingUsername,
            ownerType: "user",
            ownerId: userId,
            tx,
            allowReservedForEmail: user.email ?? null,
          });
          await tx.profile.update({
            where: { id: userId },
            data: { username: pendingUsername },
          });
        });
        const refreshedProfile = await prisma.profile.findUnique({ where: { id: userId } });
        if (refreshedProfile) {
          profile = refreshedProfile;
        }
      } catch (err) {
        if (err instanceof UsernameTakenError) {
          // outro utilizador já registou o @ entretanto; deixa username nulo
          console.warn("[auth/me] pending_username já ocupado");
        } else {
          console.error("[auth/me] erro ao aplicar pending_username:", err);
        }
      }
    }

    if (!profile) {
      throw new Error("PROFILE_MISSING");
    }
    let resolvedProfile = profile;

    const hasUserOnboardingData =
      Boolean(resolvedProfile.fullName?.trim()) && Boolean(resolvedProfile.username?.trim());

    if (!resolvedProfile.onboardingDone && hasUserOnboardingData) {
      try {
        resolvedProfile = await prisma.profile.update({
          where: { id: userId },
          data: { onboardingDone: true },
        });
      } catch (err) {
        console.warn("[auth/me] falha ao marcar onboardingDone:", err);
      }
    }

    const profileVisibility: "PUBLIC" | "PRIVATE" | "FOLLOWERS" =
      resolvedProfile.visibility === "PUBLIC"
        ? "PUBLIC"
        : resolvedProfile.visibility === "FOLLOWERS"
          ? "FOLLOWERS"
          : "PRIVATE";

    const onboardingDone = resolvedProfile.onboardingDone || hasUserOnboardingData;

    const safeProfile: ApiAuthMeResponse["profile"] = {
      id: resolvedProfile.id,
      username: resolvedProfile.username,
      fullName: resolvedProfile.fullName,
      avatarUrl: resolvedProfile.avatarUrl,
      coverUrl: resolvedProfile.coverUrl,
      updatedAt: resolvedProfile.updatedAt ?? null,
      bio: resolvedProfile.bio,
      contactPhone: resolvedProfile.contactPhone,
      isVerified: resolvedProfile.is_verified,
      favouriteCategories: resolvedProfile.favouriteCategories,
      onboardingDone,
      roles: resolvedProfile.roles,
      visibility: resolvedProfile.visibility,
      allowEmailNotifications: notificationPrefs?.allowEmailNotifications ?? true,
      allowEventReminders: notificationPrefs?.allowEventReminders ?? true,
      allowFollowRequests: notificationPrefs?.allowFollowRequests ?? true,
      allowSalesAlerts: notificationPrefs?.allowSalesAlerts ?? true,
      allowSystemAnnouncements: notificationPrefs?.allowSystemAnnouncements ?? true,
      allowMarketingCampaigns: notificationPrefs?.allowMarketingCampaigns ?? true,
      profileVisibility,
    };

    // Se email não está confirmado, força o frontend a continuar em modo "verify"
    if (!emailConfirmed) {
      return jsonWrap(
        {
          user: {
            id: user.id,
            email: user.email ?? null,
            emailConfirmed,
          },
          profile: null,
          needsEmailConfirmation: true,
        },
        { status: 200 },
      );
    }

    return jsonWrap(
      {
        user: {
          id: user.id,
          email: user.email ?? null,
          emailConfirmed,
        },
        profile: safeProfile,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return jsonWrap(
      { user: null, profile: null },
      { status: 500 }
    );
  }
}
export const GET = withApiEnvelope(_GET);
