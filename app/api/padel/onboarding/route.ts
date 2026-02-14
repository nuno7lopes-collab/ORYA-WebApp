export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Gender, PadelPreferredSide } from "@prisma/client";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  normalizeAndValidateUsername,
  setUsernameForOwner,
  UsernameTakenError,
} from "@/lib/globalUsernames";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";

const normalizePhone = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  const parsed = parsePhoneNumberFromString(value.trim(), "PT");
  if (parsed && parsed.isPossible()) return parsed.number;
  return null;
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const [profile, fallbackPadel] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        fullName: true,
        username: true,
        contactPhone: true,
        gender: true,
        avatarUrl: true,
        padelLevel: true,
        padelPreferredSide: true,
        padelClubName: true,
      },
    }),
    prisma.padelPlayerProfile.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: { level: true, preferredSide: true, clubName: true, displayName: true },
    }),
  ]);

  const padelProfile = {
    level: profile?.padelLevel ?? fallbackPadel?.level ?? null,
    preferredSide: profile?.padelPreferredSide ?? fallbackPadel?.preferredSide ?? null,
    clubName: profile?.padelClubName ?? fallbackPadel?.clubName ?? null,
    displayName: fallbackPadel?.displayName ?? null,
  };

  const profileForMissing = profile
    ? {
        ...profile,
        padelLevel: padelProfile.level,
        padelPreferredSide: padelProfile.preferredSide,
      }
    : null;

  const missing = getPadelOnboardingMissing({
    profile: profileForMissing,
    email: user.email ?? null,
  });

  return jsonWrap(
    {
      ok: true,
      profile: {
        fullName: profile?.fullName ?? null,
        username: profile?.username ?? null,
        contactPhone: profile?.contactPhone ?? null,
        gender: profile?.gender ?? null,
        email: user.email ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      },
      padelProfile,
      missing,
      completed: isPadelOnboardingComplete(missing),
    },
    { status: 200 },
  );
}

type PadelOnboardingBody = {
  fullName?: string | null;
  username?: string | null;
  contactPhone?: string | null;
  gender?: Gender | string | null;
  level?: string | null;
  preferredSide?: PadelPreferredSide | string | null;
  clubName?: string | null;
};

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as PadelOnboardingBody | null;
    if (!body) {
      return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const existingProfile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        fullName: true,
        username: true,
        contactPhone: true,
        gender: true,
        padelLevel: true,
        padelPreferredSide: true,
        padelClubName: true,
      },
    });

    if (!existingProfile) {
      return jsonWrap({ ok: false, error: "PROFILE_NOT_FOUND" }, { status: 404 });
    }

    const rawFullName = body.fullName ?? existingProfile.fullName ?? "";
    const rawUsername = body.username ?? existingProfile.username ?? "";
    const fullName = rawFullName.trim();
    const usernameInput = rawUsername.trim();
    const genderRaw = typeof body.gender === "string" ? body.gender.toUpperCase() : body.gender ?? null;
    const gender: Gender | null =
      genderRaw === "MALE" || genderRaw === "FEMALE" ? (genderRaw as Gender) : existingProfile.gender ?? null;

    const normalizedPhone =
      body.contactPhone !== undefined
        ? normalizePhone(body.contactPhone)
        : existingProfile.contactPhone ?? null;

    if (body.contactPhone !== undefined && normalizedPhone === null) {
      return jsonWrap({ ok: false, error: "INVALID_PHONE" }, { status: 400 });
    }

    const usernameValidation = normalizeAndValidateUsername(usernameInput, {
      allowReservedForEmail: user.email ?? null,
    });
    if (!usernameValidation.ok) {
      return jsonWrap(
        {
          ok: false,
          error: usernameValidation.error,
          code: usernameValidation.code ?? "USERNAME_INVALID",
        },
        { status: 400 },
      );
    }

    const usernameNormalized = usernameValidation.username;
    const hasUserOnboardingData = Boolean(fullName) && Boolean(usernameNormalized);

    const levelInput = body.level;
    const level =
      typeof levelInput === "string"
        ? levelInput.trim() || null
        : levelInput === null
          ? null
          : undefined;

    const preferredSideInput = body.preferredSide;
    let preferredSide: PadelPreferredSide | null | undefined;
    if (typeof preferredSideInput === "string") {
      const normalized = preferredSideInput.trim().toUpperCase();
      if (!normalized) {
        preferredSide = null;
      } else if (normalized === "ESQUERDA" || normalized === "DIREITA" || normalized === "QUALQUER") {
        preferredSide = normalized as PadelPreferredSide;
      } else {
        return jsonWrap({ ok: false, error: "INVALID_PREFERRED_SIDE" }, { status: 400 });
      }
    } else if (preferredSideInput === null) {
      preferredSide = null;
    } else {
      preferredSide = undefined;
    }

    const clubNameInput = body.clubName;
    const clubName =
      typeof clubNameInput === "string"
        ? clubNameInput.trim() || null
        : clubNameInput === null
          ? null
          : undefined;

    const profile = await prisma.$transaction(async (tx) => {
      if (existingProfile.username !== usernameNormalized) {
        await setUsernameForOwner({
          username: usernameNormalized,
          ownerType: "user",
          ownerId: user.id,
          tx,
          allowReservedForEmail: user.email ?? null,
        });
      }

      const updatedProfile = await tx.profile.update({
        where: { id: user.id },
        data: {
          fullName: fullName || existingProfile.fullName,
          username: usernameNormalized,
          ...(normalizedPhone !== undefined ? { contactPhone: normalizedPhone } : {}),
          ...(gender ? { gender } : {}),
          ...(level !== undefined ? { padelLevel: level } : {}),
          ...(preferredSide !== undefined ? { padelPreferredSide: preferredSide } : {}),
          ...(clubName !== undefined ? { padelClubName: clubName } : {}),
          ...(hasUserOnboardingData ? { onboardingDone: true } : {}),
        },
        select: {
          fullName: true,
          username: true,
          contactPhone: true,
          gender: true,
          padelLevel: true,
          padelPreferredSide: true,
          padelClubName: true,
        },
      });

      const playerName = fullName || updatedProfile.fullName || "Jogador Padel";
      const playerData: {
        fullName?: string;
        displayName?: string;
        email?: string;
        phone?: string | null;
        gender?: string;
        level?: string | null;
        preferredSide?: PadelPreferredSide | null;
        clubName?: string | null;
      } = {};
      if (playerName) {
        playerData.fullName = playerName;
        playerData.displayName = playerName;
      }
      if (user.email) playerData.email = user.email;
      if (normalizedPhone !== undefined) playerData.phone = normalizedPhone;
      if (gender) playerData.gender = gender;
      if (level !== undefined) playerData.level = level;
      if (preferredSide !== undefined) playerData.preferredSide = preferredSide;
      if (clubName !== undefined) playerData.clubName = clubName;

      if (Object.keys(playerData).length > 0) {
        await tx.padelPlayerProfile.updateMany({
          where: { userId: user.id },
          data: playerData,
        });
      }

      return updatedProfile;
    });

    const missing = getPadelOnboardingMissing({
      profile,
      email: user.email ?? null,
    });

    return jsonWrap(
      {
        ok: true,
        profile: {
          fullName: profile.fullName,
          username: profile.username,
          contactPhone: profile.contactPhone,
          gender: profile.gender,
        },
        padelProfile: {
          level: profile.padelLevel ?? null,
          preferredSide: profile.padelPreferredSide ?? null,
          clubName: profile.padelClubName ?? null,
        },
        missing,
        completed: isPadelOnboardingComplete(missing),
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      return jsonWrap(
        { ok: false, error: "Este username já está a ser utilizado.", code: "USERNAME_TAKEN" },
        { status: 409 },
      );
    }
    console.error("[padel/onboarding] erro", err);
    return jsonWrap({ ok: false, error: "Erro inesperado." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
