// app/api/me/route.ts
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
// Tipagem simples devolvida ao frontend
interface SupabaseUser {
  id: string;
  email?: string | null;
}

interface AuthErrorLike {
  status?: number;
  name?: string;
}

async function _GET(req: Request) {
  try {
    const ctx = getRequestContext(req);
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error: userError,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

    // 🔹 Caso típico: sem sessão → devolver 401 sem lançar 500
    if (userError) {
      const err = userError as AuthErrorLike;
      const isAuthMissing =
        err?.status === 400 ||
        err?.name === "AuthSessionMissingError";

      if (isAuthMissing) {
        return jsonWrap(
          { success: false, error: "Precisas de iniciar sessão." },
          { status: 401 },
        );
      }

      // Outros erros
      console.warn("[GET /api/me] Erro inesperado em getUser:", {
        userError,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        orgId: ctx.orgId,
      });
      return jsonWrap(
        { success: false, error: "Erro ao obter sessão." },
        { status: 500 },
      );
    }

    // 🔹 Caso sem user (sem sessão válida)
    if (!user) {
      return jsonWrap(
        { success: false, error: "Precisas de iniciar sessão." },
        { status: 401 },
      );
    }

    // 🔹 User válido — devolvemos apenas os campos necessários
    const safeUser: SupabaseUser = {
      id: user.id,
      email: user.email ?? undefined,
    };

    const prismaProfilePromise = prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        fullName: true,
        username: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        padelLevel: true,
        favouriteCategories: true,
        visibility: true,
        onboardingDone: true,
      },
    });

    const notificationPrefsPromise = prisma.notificationPreference.findUnique({
      where: { userId: user.id },
      select: {
        allowEmailNotifications: true,
        allowEventReminders: true,
        allowFollowRequests: true,
      },
    });

    const [prismaProfileResult, notificationPrefsResult] = await Promise.allSettled([
      prismaProfilePromise,
      notificationPrefsPromise,
    ]);

    const prismaProfile =
      prismaProfileResult.status === "fulfilled" ? prismaProfileResult.value : null;
    const prismaError =
      prismaProfileResult.status === "rejected" ? prismaProfileResult.reason : null;

    const notificationPrefs =
      notificationPrefsResult.status === "fulfilled" ? notificationPrefsResult.value : null;
    const notificationError =
      notificationPrefsResult.status === "rejected" ? notificationPrefsResult.reason : null;

    if (prismaError || notificationError) {
      console.warn("[GET /api/me] Erro ao carregar profile (prisma):", {
        prismaError,
        notificationError,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        orgId: ctx.orgId,
      });
    }

    const mergedProfile = prismaProfile
      ? {
          id: prismaProfile.id,
          full_name: prismaProfile.fullName ?? null,
          username: prismaProfile.username ?? null,
          avatar_url: prismaProfile.avatarUrl ?? null,
          cover_url: prismaProfile.coverUrl ?? null,
          bio: prismaProfile.bio ?? null,
          padel_level: prismaProfile.padelLevel ?? null,
          favourite_categories: prismaProfile.favouriteCategories ?? [],
          visibility: prismaProfile.visibility ?? null,
          allow_email_notifications: notificationPrefs?.allowEmailNotifications ?? null,
          allow_event_reminders: notificationPrefs?.allowEventReminders ?? null,
          allow_follow_requests: notificationPrefs?.allowFollowRequests ?? null,
          onboarding_done: prismaProfile.onboardingDone ?? null,
          onboardingDone: prismaProfile.onboardingDone ?? null,
        }
      : null;

    return jsonWrap({
      success: true,
      user: safeUser,
      profile: mergedProfile,
    });
  } catch (err) {
    const ctx = getRequestContext(req);
    console.error("[GET /api/me] Erro inesperado:", {
      err,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      orgId: ctx.orgId,
    });
    return jsonWrap(
      { success: false, error: "Erro ao carregar o perfil." },
      { status: 500 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
