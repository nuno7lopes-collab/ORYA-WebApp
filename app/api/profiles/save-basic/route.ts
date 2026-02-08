// app/api/profiles/save-basic/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { setUsernameForOwner, UsernameTakenError, normalizeAndValidateUsername } from "@/lib/globalUsernames";
import { getNotificationPrefs } from "@/lib/notifications";
import { normalizeProfileAvatarUrl, normalizeProfileCoverUrl } from "@/lib/profileMedia";
import { INTEREST_MAX_SELECTION, normalizeInterestSelection } from "@/lib/interests";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

interface SaveBasicBody {
  fullName?: string;
  username?: string;
  contactPhone?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  padelLevel?: string | null;
  visibility?: "PUBLIC" | "PRIVATE" | "FOLLOWERS";
  favouriteCategories?: string[];
  allowEmailNotifications?: boolean;
  allowEventReminders?: boolean;
  allowFollowRequests?: boolean;
  followersCount?: number; // ignored for now (future-proof)
  followingCount?: number; // ignored for now (future-proof)
}

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap(
        { ok: false, error: "Não autenticado." },
        { status: 401 }
      );
    }

    const userId = user.id;

    const body = (await req.json().catch(() => null)) as SaveBasicBody | null;

    if (!body || typeof body !== "object") {
      return jsonWrap(
        { ok: false, error: "Body inválido." },
        { status: 400 }
      );
    }

    const rawFullName = body.fullName ?? "";
    const rawUsername = body.username ?? "";
    const rawPhone = body.contactPhone;
    const rawAvatarUrl = body.avatarUrl;
    const rawCoverUrl = body.coverUrl;
    const avatarUrl = rawAvatarUrl === undefined ? undefined : normalizeProfileAvatarUrl(rawAvatarUrl);
    const coverUrl = rawCoverUrl === undefined ? undefined : normalizeProfileCoverUrl(rawCoverUrl);
    const rawBio = body.bio;
    const rawPadelLevel = body.padelLevel;
    const visibility =
      body.visibility === "PRIVATE" || body.visibility === "PUBLIC" || body.visibility === "FOLLOWERS"
        ? body.visibility
        : undefined;
    const favouriteCategories = Array.isArray(body.favouriteCategories)
      ? normalizeInterestSelection(
          body.favouriteCategories.filter(
            (item): item is string => typeof item === "string",
          ),
          INTEREST_MAX_SELECTION,
        )
      : undefined;
    const allowEmailNotifications = typeof body.allowEmailNotifications === "boolean" ? body.allowEmailNotifications : undefined;
    const allowEventReminders = typeof body.allowEventReminders === "boolean" ? body.allowEventReminders : undefined;
    const allowFollowRequests = typeof body.allowFollowRequests === "boolean" ? body.allowFollowRequests : undefined;

    const fullName = rawFullName.trim();
    const username = rawUsername.trim();
    const bio =
      typeof rawBio === "string"
        ? rawBio.trim().slice(0, 280)
        : rawBio === null
          ? null
          : undefined;
    const padelLevel =
      typeof rawPadelLevel === "string"
        ? rawPadelLevel.trim().slice(0, 32)
        : rawPadelLevel === null
          ? null
          : undefined;

    let normalizedPhone: string | null | undefined = undefined;
    if (rawPhone !== undefined) {
      if (rawPhone === null || rawPhone === "") {
        normalizedPhone = null;
      } else if (typeof rawPhone === "string") {
        const parsed = parsePhoneNumberFromString(rawPhone.trim(), "PT");
        if (parsed && parsed.isPossible()) {
          normalizedPhone = parsed.number; // E.164
        } else {
          return jsonWrap(
            { ok: false, error: "Telefone inválido." },
            { status: 400 },
          );
        }
      }
    }

    const validatedUsername = normalizeAndValidateUsername(username, {
      allowReservedForEmail: user.email ?? null,
    });

    if (!fullName || !validatedUsername.ok) {
      return jsonWrap(
        {
          ok: false,
          error:
            validatedUsername.ok
              ? "Nome completo e username são obrigatórios."
              : validatedUsername.error,
        },
        { status: 400 }
      );
    }

    const usernameNormalized = validatedUsername.username;

    const notificationUpdates: Record<string, boolean> = {};
    if (allowEmailNotifications !== undefined) notificationUpdates.allowEmailNotifications = allowEmailNotifications;
    if (allowEventReminders !== undefined) notificationUpdates.allowEventReminders = allowEventReminders;
    if (allowFollowRequests !== undefined) notificationUpdates.allowFollowRequests = allowFollowRequests;

    const profile = await prisma.$transaction(async (tx) => {
      await setUsernameForOwner({
        username: usernameNormalized,
        ownerType: "user",
        ownerId: userId,
        tx,
        allowReservedForEmail: user.email ?? null,
      });

      const profile = await tx.profile.upsert({
        where: { id: userId },
        update: {
          fullName,
          username: usernameNormalized,
          ...(bio !== undefined ? { bio } : {}),
          onboardingDone: true,
          ...(normalizedPhone !== undefined ? { contactPhone: normalizedPhone } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl: avatarUrl || null } : {}),
          ...(coverUrl !== undefined ? { coverUrl: coverUrl || null } : {}),
          ...(padelLevel !== undefined ? { padelLevel } : {}),
          ...(visibility ? { visibility } : {}),
          ...(favouriteCategories !== undefined ? { favouriteCategories } : {}),
        },
        create: {
          id: userId,
          fullName,
          username: usernameNormalized,
          bio: bio ?? null,
          onboardingDone: true,
          roles: ["user"],
          contactPhone: normalizedPhone ?? null,
          avatarUrl: avatarUrl ?? null,
          coverUrl: coverUrl ?? null,
          padelLevel: padelLevel ?? null,
          visibility: visibility ?? "PUBLIC",
          favouriteCategories: favouriteCategories ?? [],
        },
      });

      if (Object.keys(notificationUpdates).length > 0) {
        await tx.notificationPreference.upsert({
          where: { userId },
          update: notificationUpdates,
          create: { userId, ...notificationUpdates },
        });
      }

      return profile;
    });

    const notificationPrefs = await getNotificationPrefs(userId).catch(() => null);

    const safeProfile = {
      id: profile.id,
      username: profile.username,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      coverUrl: profile.coverUrl,
      updatedAt: profile.updatedAt,
      bio: profile.bio,
      padelLevel: profile.padelLevel,
      favouriteCategories: profile.favouriteCategories,
      onboardingDone: profile.onboardingDone,
      roles: profile.roles,
      visibility: profile.visibility,
      allowEmailNotifications: notificationPrefs?.allowEmailNotifications ?? true,
      allowEventReminders: notificationPrefs?.allowEventReminders ?? true,
      allowFollowRequests: notificationPrefs?.allowFollowRequests ?? true,
    };

    return jsonWrap(
      {
        ok: true,
        profile: safeProfile,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      return jsonWrap(
        {
          ok: false,
          error: "Este username já está a ser utilizado.",
          code: "USERNAME_TAKEN",
        },
        { status: 409 },
      );
    }
    console.error("POST /api/profiles/save-basic error:", err);
    return jsonWrap(
      {
        ok: false,
        error: "Erro inesperado ao guardar perfil.",
      },
      { status: 500 }
    );
  }
}
export const POST = withApiEnvelope(_POST);
