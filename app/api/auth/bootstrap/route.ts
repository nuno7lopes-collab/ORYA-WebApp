import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { User } from "@supabase/supabase-js";
import { setUsernameForOwner, UsernameTakenError } from "@/lib/globalUsernames";
import { normalizeProfileAvatarUrl } from "@/lib/profileMedia";
import { linkPendingWorkforceInvitesToUser } from "@/lib/workforceInvites";
import { claimIdentity } from "@/lib/ownership/claimIdentity";

type SupabaseUserMetadata = {
  full_name?: string;
  name?: string;
  avatar_url?: string;
  pending_username?: string;
};

async function _POST() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, errorCode: "UNAUTHENTICATED", message: "Não autenticado." }, { status: 401 });
    }

    const supaUser = user as User;
    const emailConfirmed =
      Boolean(supaUser.email_confirmed_at) ||
      Boolean((supaUser as { confirmed_at?: string | null })?.confirmed_at) ||
      false;
    const userMetadata = (user.user_metadata ?? {}) as SupabaseUserMetadata;
    const userId = user.id;

    // Profile init/update side-effects vivem aqui; /api/auth/me mantém-se estritamente read-only.
    let profile = await prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) {
      try {
        profile = await prisma.profile.create({
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
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          profile = await prisma.profile.findUnique({ where: { id: userId } });
        } else {
          throw err;
        }
      }
    }
    if (!profile) {
      throw new Error("PROFILE_INIT_FAILED");
    }

    const pendingUsername =
      typeof userMetadata.pending_username === "string" ? userMetadata.pending_username : null;
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
        const refreshed = await prisma.profile.findUnique({ where: { id: userId } });
        if (refreshed) {
          profile = refreshed;
        }
      } catch (err) {
        if (err instanceof UsernameTakenError) {
          console.warn("[auth/bootstrap] pending_username já ocupado");
        } else {
          console.error("[auth/bootstrap] erro ao aplicar pending_username:", err);
        }
      }
    }

    const hasUserOnboardingData = Boolean(profile.fullName?.trim()) && Boolean(profile.username?.trim());
    if (!profile.onboardingDone && hasUserOnboardingData) {
      try {
        profile = await prisma.profile.update({
          where: { id: userId },
          data: { onboardingDone: true },
        });
      } catch (err) {
        console.warn("[auth/bootstrap] falha ao marcar onboardingDone:", err);
      }
    }

    if (emailConfirmed) {
      await claimIdentity(user.email ?? "", userId, {
        requireVerified: true,
        mergedBy: userId,
      }).catch((err) => {
        console.warn("[auth/bootstrap] claimIdentity failed:", err);
      });

      await linkPendingWorkforceInvitesToUser({
        userId,
        email: user.email ?? null,
      }).catch((err) => {
        console.warn("[auth/bootstrap] workforce invite link failed:", err);
      });
    }

    return jsonWrap(
      {
        ok: true,
        user: {
          id: user.id,
          email: user.email ?? null,
          emailConfirmed,
        },
        profile: {
          id: profile.id,
          username: profile.username,
          fullName: profile.fullName,
          onboardingDone: profile.onboardingDone || hasUserOnboardingData,
        },
        needsEmailConfirmation: !emailConfirmed,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[auth/bootstrap] unexpected error:", err);
    return jsonWrap(
      { ok: false, errorCode: "BOOTSTRAP_FAILED", message: "Não foi possível preparar a sessão." },
      { status: 500 },
    );
  }
}

export const POST = withApiEnvelope(_POST);
