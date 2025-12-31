// app/api/profiles/save-basic/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { setUsernameForOwner, UsernameTakenError, normalizeAndValidateUsername } from "@/lib/globalUsernames";
import { getNotificationPrefs } from "@/lib/notifications";
import { normalizeProfileAvatarUrl, normalizeProfileCoverUrl } from "@/lib/profileMedia";

interface SaveBasicBody {
  fullName?: string;
  username?: string;
  contactPhone?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  visibility?: "PUBLIC" | "PRIVATE";
  allowEmailNotifications?: boolean;
  allowEventReminders?: boolean;
  allowFriendRequests?: boolean;
  followersCount?: number; // ignored for now (future-proof)
  followingCount?: number; // ignored for now (future-proof)
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 }
      );
    }

    const userId = user.id;

    const body = (await req.json().catch(() => null)) as SaveBasicBody | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
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
    const visibility = body.visibility === "PRIVATE" ? "PRIVATE" : body.visibility === "PUBLIC" ? "PUBLIC" : undefined;
    const allowEmailNotifications = typeof body.allowEmailNotifications === "boolean" ? body.allowEmailNotifications : undefined;
    const allowEventReminders = typeof body.allowEventReminders === "boolean" ? body.allowEventReminders : undefined;
    const allowFriendRequests = typeof body.allowFriendRequests === "boolean" ? body.allowFriendRequests : undefined;

    const fullName = rawFullName.trim();
    const username = rawUsername.trim();
    const bio =
      typeof rawBio === "string"
        ? rawBio.trim().slice(0, 280)
        : rawBio === null
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
          return NextResponse.json(
            { ok: false, error: "Telefone inválido." },
            { status: 400 },
          );
        }
      }
    }

    const validatedUsername = normalizeAndValidateUsername(username);

    if (!fullName || !validatedUsername.ok) {
      return NextResponse.json(
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
    if (allowFriendRequests !== undefined) notificationUpdates.allowFriendRequests = allowFriendRequests;

    const profile = await prisma.$transaction(async (tx) => {
      await setUsernameForOwner({
        username: usernameNormalized,
        ownerType: "user",
        ownerId: userId,
        tx,
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
          ...(visibility ? { visibility } : {}),
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
          visibility: visibility ?? "PUBLIC",
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
      bio: profile.bio,
      city: profile.city,
      favouriteCategories: profile.favouriteCategories,
      onboardingDone: profile.onboardingDone,
      roles: profile.roles,
      visibility: profile.visibility,
      allowEmailNotifications: notificationPrefs?.allowEmailNotifications ?? true,
      allowEventReminders: notificationPrefs?.allowEventReminders ?? true,
      allowFriendRequests: notificationPrefs?.allowFriendRequests ?? true,
    };

    return NextResponse.json(
      {
        ok: true,
        profile: safeProfile,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Este username já está a ser utilizado.",
          code: "USERNAME_TAKEN",
        },
        { status: 409 },
      );
    }
    console.error("POST /api/profiles/save-basic error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro inesperado ao guardar perfil.",
      },
      { status: 500 }
    );
  }
}
