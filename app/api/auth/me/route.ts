import type { User } from "@supabase/supabase-js";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getNotificationPrefs } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type ApiAuthMeResponse = {
  user: {
    id: string;
    email: string | null;
    emailConfirmed: boolean;
    emailConfirmedAt: string | null;
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
      return jsonWrap(
        {
          ok: false,
          errorCode: "UNAUTHENTICATED",
          message: "Sessão não autenticada.",
          retryable: false,
        },
        { status: 401 },
      );
    }

    const supaUser = user as User;
    const emailConfirmedAt =
      supaUser.email_confirmed_at ??
      ((supaUser as { confirmed_at?: string | null })?.confirmed_at ?? null);
    const emailConfirmed = Boolean(emailConfirmedAt);

    // /api/auth/me é estritamente read-only: nenhuma mutação síncrona neste endpoint.
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    const notificationPrefs = profile ? await getNotificationPrefs(user.id).catch(() => null) : null;

    if (!emailConfirmed) {
      return jsonWrap(
        {
          user: {
            id: user.id,
            email: user.email ?? null,
            emailConfirmed,
            emailConfirmedAt,
          },
          profile: null,
          needsEmailConfirmation: true,
        } satisfies ApiAuthMeResponse,
        { status: 200 },
      );
    }

    if (!profile) {
      return jsonWrap(
        {
          user: {
            id: user.id,
            email: user.email ?? null,
            emailConfirmed,
            emailConfirmedAt,
          },
          profile: null,
        } satisfies ApiAuthMeResponse,
        { status: 200 },
      );
    }

    const profileVisibility: "PUBLIC" | "PRIVATE" | "FOLLOWERS" =
      profile.visibility === "PUBLIC"
        ? "PUBLIC"
        : profile.visibility === "FOLLOWERS"
          ? "FOLLOWERS"
          : "PRIVATE";

    return jsonWrap(
      {
        user: {
          id: user.id,
          email: user.email ?? null,
          emailConfirmed,
          emailConfirmedAt,
        },
        profile: {
          id: profile.id,
          username: profile.username,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          coverUrl: profile.coverUrl,
          updatedAt: profile.updatedAt ?? null,
          bio: profile.bio,
          contactPhone: profile.contactPhone,
          isVerified: profile.is_verified,
          favouriteCategories: profile.favouriteCategories,
          onboardingDone: profile.onboardingDone,
          roles: profile.roles,
          visibility: profile.visibility,
          allowEmailNotifications: notificationPrefs?.allowEmailNotifications ?? true,
          allowEventReminders: notificationPrefs?.allowEventReminders ?? true,
          allowFollowRequests: notificationPrefs?.allowFollowRequests ?? true,
          allowSalesAlerts: notificationPrefs?.allowSalesAlerts ?? true,
          allowSystemAnnouncements: notificationPrefs?.allowSystemAnnouncements ?? true,
          allowMarketingCampaigns: notificationPrefs?.allowMarketingCampaigns ?? true,
          profileVisibility,
        },
      } satisfies ApiAuthMeResponse,
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return jsonWrap(
      {
        ok: false,
        errorCode: "SERVER_ERROR",
        message: "Não foi possível carregar a sessão.",
        retryable: true,
      },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
