// app/api/me/route.ts
import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";

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

    // Fetch profile from Supabase (public or view)
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.warn("[GET /api/me] Erro ao carregar profile:", {
        profileError,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        orgId: ctx.orgId,
      });
    }

    // Fetch profile from Prisma (source of truth for onboarding fields)
    type PrismaProfile = Awaited<ReturnType<typeof prisma.profile.findUnique>>;
    let prismaProfile: PrismaProfile = null;
    let notificationPrefs: Awaited<ReturnType<typeof prisma.notificationPreference.findUnique>> | null = null;
    try {
      prismaProfile = await prisma.profile.findUnique({ where: { id: user.id } });
      notificationPrefs = await prisma.notificationPreference.findUnique({ where: { userId: user.id } });
    } catch (prismaError) {
      console.warn("[GET /api/me] Erro ao carregar profile (prisma):", {
        prismaError,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        orgId: ctx.orgId,
      });
    }

    const mergedProfile = prismaProfile
      ? {
          ...(profile ?? {}),
          id: prismaProfile.id,
          full_name: prismaProfile.fullName ?? profile?.full_name ?? null,
          username: prismaProfile.username ?? profile?.username ?? null,
          avatar_url: prismaProfile.avatarUrl ?? profile?.avatar_url ?? null,
          cover_url: prismaProfile.coverUrl ?? (profile as any)?.cover_url ?? null,
          bio: prismaProfile.bio ?? profile?.bio ?? null,
          city: prismaProfile.city ?? profile?.city ?? null,
          padel_level: prismaProfile.padelLevel ?? profile?.padel_level ?? null,
          favourite_categories: prismaProfile.favouriteCategories ?? (profile as any)?.favourite_categories ?? [],
          visibility: prismaProfile.visibility ?? (profile as any)?.visibility ?? null,
          allow_email_notifications:
            notificationPrefs?.allowEmailNotifications ?? (profile as any)?.allow_email_notifications ?? null,
          allow_event_reminders:
            notificationPrefs?.allowEventReminders ?? (profile as any)?.allow_event_reminders ?? null,
          allow_follow_requests:
            notificationPrefs?.allowFollowRequests ?? (profile as any)?.allow_follow_requests ?? null,
          onboarding_done: prismaProfile.onboardingDone ?? profile?.onboarding_done ?? null,
          onboardingDone: prismaProfile.onboardingDone ?? (profile as any)?.onboardingDone ?? null,
        }
      : profile ?? null;

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
