// app/api/me/route.ts
import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";
import { normalizeAndValidateUsername, setUsernameForOwner } from "@/lib/globalUsernames";

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
    } = await supabase.auth.getUser();

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

    let prismaProfile =
      prismaProfileResult.status === "fulfilled" ? prismaProfileResult.value : null;
    const prismaError =
      prismaProfileResult.status === "rejected" ? prismaProfileResult.reason : null;

    const notificationPrefs =
      notificationPrefsResult.status === "fulfilled" ? notificationPrefsResult.value : null;
    const notificationError =
      notificationPrefsResult.status === "rejected" ? notificationPrefsResult.reason : null;

    let supabaseProfile: Record<string, unknown> | null = null;
    if (!prismaProfile) {
      const supabaseProfileResult = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_url, cover_url, bio, padel_level, favourite_categories, visibility, allow_email_notifications, allow_event_reminders, allow_follow_requests, onboarding_done, onboardingDone",
        )
        .eq("id", user.id)
        .single();

      supabaseProfile = supabaseProfileResult.data ?? null;
      if (supabaseProfileResult.error) {
        console.warn("[GET /api/me] Erro ao carregar profile (supabase):", {
          supabaseError: supabaseProfileResult.error,
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          orgId: ctx.orgId,
        });
      }
    }

    if (!prismaProfile && supabaseProfile) {
      const rawUsername = typeof (supabaseProfile as any)?.username === "string"
        ? String((supabaseProfile as any).username)
        : "";
      const validated = rawUsername
        ? normalizeAndValidateUsername(rawUsername, { allowReservedForEmail: user.email ?? null })
        : null;
      const safeUsername = validated?.ok ? validated.username : null;
      const visibilityRaw = (supabaseProfile as any)?.visibility;
      const visibility =
        visibilityRaw === "PUBLIC" || visibilityRaw === "PRIVATE" || visibilityRaw === "FOLLOWERS"
          ? visibilityRaw
          : "PUBLIC";
      const onboardingDone =
        typeof (supabaseProfile as any)?.onboarding_done === "boolean"
          ? (supabaseProfile as any).onboarding_done
          : typeof (supabaseProfile as any)?.onboardingDone === "boolean"
            ? (supabaseProfile as any).onboardingDone
            : false;

      try {
        prismaProfile = await prisma.$transaction(async (tx) => {
          let usernameToPersist: string | null = null;
          if (safeUsername) {
            try {
              await setUsernameForOwner({
                username: safeUsername,
                ownerType: "user",
                ownerId: user.id,
                tx,
                allowReservedForEmail: user.email ?? null,
              });
              usernameToPersist = safeUsername;
            } catch {
              usernameToPersist = null;
            }
          }

          return tx.profile.upsert({
            where: { id: user.id },
            update: {
              ...(typeof (supabaseProfile as any)?.full_name === "string"
                ? { fullName: (supabaseProfile as any).full_name }
                : {}),
              ...(usernameToPersist ? { username: usernameToPersist } : {}),
              ...(typeof (supabaseProfile as any)?.avatar_url === "string"
                ? { avatarUrl: (supabaseProfile as any).avatar_url }
                : {}),
              ...(typeof (supabaseProfile as any)?.cover_url === "string"
                ? { coverUrl: (supabaseProfile as any).cover_url }
                : {}),
              ...(typeof (supabaseProfile as any)?.bio === "string"
                ? { bio: (supabaseProfile as any).bio }
                : {}),
              ...(typeof (supabaseProfile as any)?.padel_level === "string"
                ? { padelLevel: (supabaseProfile as any).padel_level }
                : {}),
              ...(Array.isArray((supabaseProfile as any)?.favourite_categories)
                ? { favouriteCategories: (supabaseProfile as any).favourite_categories }
                : {}),
              ...(visibility ? { visibility } : {}),
              onboardingDone,
            },
            create: {
              id: user.id,
              fullName:
                typeof (supabaseProfile as any)?.full_name === "string"
                  ? (supabaseProfile as any).full_name
                  : null,
              username: usernameToPersist,
              avatarUrl:
                typeof (supabaseProfile as any)?.avatar_url === "string"
                  ? (supabaseProfile as any).avatar_url
                  : null,
              coverUrl:
                typeof (supabaseProfile as any)?.cover_url === "string"
                  ? (supabaseProfile as any).cover_url
                  : null,
              bio:
                typeof (supabaseProfile as any)?.bio === "string"
                  ? (supabaseProfile as any).bio
                  : null,
              padelLevel:
                typeof (supabaseProfile as any)?.padel_level === "string"
                  ? (supabaseProfile as any).padel_level
                  : null,
              favouriteCategories: Array.isArray((supabaseProfile as any)?.favourite_categories)
                ? (supabaseProfile as any).favourite_categories
                : [],
              visibility,
              onboardingDone,
              roles: ["user"],
            },
          });
        });
      } catch (err) {
        console.warn("[GET /api/me] Falha ao sincronizar profile:", {
          err,
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
          orgId: ctx.orgId,
        });
      }
    }

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
          ...(supabaseProfile ?? {}),
          id: prismaProfile.id,
          full_name: prismaProfile.fullName ?? (supabaseProfile as any)?.full_name ?? null,
          username: prismaProfile.username ?? (supabaseProfile as any)?.username ?? null,
          avatar_url: prismaProfile.avatarUrl ?? (supabaseProfile as any)?.avatar_url ?? null,
          cover_url: prismaProfile.coverUrl ?? (supabaseProfile as any)?.cover_url ?? null,
          bio: prismaProfile.bio ?? (supabaseProfile as any)?.bio ?? null,
          padel_level: prismaProfile.padelLevel ?? (supabaseProfile as any)?.padel_level ?? null,
          favourite_categories: prismaProfile.favouriteCategories ?? (supabaseProfile as any)?.favourite_categories ?? [],
          visibility: prismaProfile.visibility ?? (supabaseProfile as any)?.visibility ?? null,
          allow_email_notifications:
            notificationPrefs?.allowEmailNotifications ?? (supabaseProfile as any)?.allow_email_notifications ?? null,
          allow_event_reminders:
            notificationPrefs?.allowEventReminders ?? (supabaseProfile as any)?.allow_event_reminders ?? null,
          allow_follow_requests:
            notificationPrefs?.allowFollowRequests ?? (supabaseProfile as any)?.allow_follow_requests ?? null,
          onboarding_done: prismaProfile.onboardingDone ?? (supabaseProfile as any)?.onboarding_done ?? null,
          onboardingDone: prismaProfile.onboardingDone ?? (supabaseProfile as any)?.onboardingDone ?? null,
        }
      : supabaseProfile ?? null;

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
