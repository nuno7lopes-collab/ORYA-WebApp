export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Gender, PadelPreferredSide } from "@prisma/client";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  normalizeAndValidateUsername,
  setUsernameForOwner,
  UsernameTakenError,
} from "@/lib/globalUsernames";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";
import { isValidPhone, normalizePhone, resolvePhoneNormalizationOptions } from "@/lib/phone";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

function parsePositiveInt(raw: string | null | undefined) {
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toNumericParam(raw: unknown) {
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  if (typeof raw === "string") return raw;
  return null;
}

const normalizePhoneForStorage = (
  value: string | null | undefined,
  options?: Parameters<typeof normalizePhone>[1],
) => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  if (isValidPhone(value)) return normalizePhone(value, options);
  return null;
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const eventId = parsePositiveInt(req.nextUrl.searchParams.get("eventId"));
  const organizationId = parsePositiveInt(req.nextUrl.searchParams.get("organizationId"));
  const categoryId = parsePositiveInt(req.nextUrl.searchParams.get("categoryId"));

  const [profile, fallbackPadel, eventContext, categoryFromEvent, looseCategory] = await Promise.all([
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
    eventId
      ? prisma.event.findFirst({
          where: {
            id: eventId,
            isDeleted: false,
            templateType: "PADEL",
            ...(organizationId ? { organizationId } : {}),
          },
          select: {
            id: true,
            title: true,
            slug: true,
          },
        })
      : Promise.resolve(null),
    eventId && categoryId
      ? prisma.padelEventCategoryLink.findFirst({
          where: {
            eventId,
            padelCategoryId: categoryId,
            isEnabled: true,
          },
          select: {
            category: {
              select: {
                id: true,
                label: true,
                genderRestriction: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    !eventId && categoryId
      ? prisma.padelCategory.findFirst({
          where: {
            id: categoryId,
            isActive: true,
            ...(organizationId ? { organizationId } : {}),
          },
          select: {
            id: true,
            label: true,
            genderRestriction: true,
          },
        })
      : Promise.resolve(null),
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

  const resolvedCategory = categoryFromEvent?.category ?? looseCategory ?? null;

  return jsonWrap(
    {
      ok: true,
      event: eventContext
        ? {
            id: eventContext.id,
            title: eventContext.title,
            slug: eventContext.slug,
          }
        : null,
      category: resolvedCategory
        ? {
            id: resolvedCategory.id,
            label: resolvedCategory.label,
            genderRestriction: resolvedCategory.genderRestriction ?? null,
          }
        : null,
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
  eventId?: number | string | null;
  organizationId?: number | string | null;
  categoryId?: number | string | null;
};

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as PadelOnboardingBody | null;
    if (!body) {
      return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });
    }

    const eventId = parsePositiveInt(
      toNumericParam(body.eventId) ?? req.nextUrl.searchParams.get("eventId"),
    );
    const organizationId = parsePositiveInt(
      toNumericParam(body.organizationId) ?? req.nextUrl.searchParams.get("organizationId"),
    );
    const categoryId = parsePositiveInt(
      toNumericParam(body.categoryId) ?? req.nextUrl.searchParams.get("categoryId"),
    );

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
    let gender: Gender | null =
      genderRaw === "MALE" || genderRaw === "FEMALE" ? (genderRaw as Gender) : existingProfile.gender ?? null;

    const phoneOptions = resolvePhoneNormalizationOptions({ headers: req.headers });
    const normalizedPhone =
      body.contactPhone !== undefined
        ? normalizePhoneForStorage(body.contactPhone, phoneOptions)
        : existingProfile.contactPhone ?? null;

    if (body.contactPhone !== undefined && normalizedPhone === null) {
      return jsonWrap({ ok: false, error: "INVALID_PHONE" }, { status: 400 });
    }

    if (body.gender !== undefined && !gender) {
      return jsonWrap({ ok: false, error: "GENDER_REQUIRED" }, { status: 400 });
    }

    const usernameValidation = normalizeAndValidateUsername(usernameInput, {
      allowReservedForEmail: user.email ?? null,
    });
    if (!usernameValidation.ok) {
      return jsonWrap(
        {
          ok: false,
          errorCode: usernameValidation.code ?? "USERNAME_INVALID",
          error: usernameValidation.error,
        },
        { status: 400 },
      );
    }

    const usernameNormalized = usernameValidation.username;

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

    let requiredGenderRaw: string | null = null;
    if (categoryId) {
      if (eventId) {
        const categoryLink = await prisma.padelEventCategoryLink.findFirst({
          where: {
            eventId,
            padelCategoryId: categoryId,
            isEnabled: true,
            ...(organizationId ? { event: { organizationId } } : {}),
          },
          select: { category: { select: { genderRestriction: true } } },
        });
        requiredGenderRaw = categoryLink?.category?.genderRestriction ?? null;
      } else {
        const category = await prisma.padelCategory.findFirst({
          where: {
            id: categoryId,
            isActive: true,
            ...(organizationId ? { organizationId } : {}),
          },
          select: { genderRestriction: true },
        });
        requiredGenderRaw = category?.genderRestriction ?? null;
      }
    }
    const requiredGender =
      requiredGenderRaw?.toUpperCase() === "MALE" || requiredGenderRaw?.toUpperCase() === "FEMALE"
        ? (requiredGenderRaw.toUpperCase() as Gender)
        : null;

    if (requiredGender) {
      if (!gender) {
        gender = requiredGender;
      }
      if (gender !== requiredGender) {
        return jsonWrap({ ok: false, error: "CATEGORY_GENDER_MISMATCH" }, { status: 409 });
      }
    }

    const levelForCompletion = level !== undefined ? level : existingProfile.padelLevel;
    const preferredSideForCompletion =
      preferredSide !== undefined ? preferredSide : existingProfile.padelPreferredSide;
    const hasUserOnboardingData = Boolean(
      fullName &&
        usernameNormalized &&
        gender &&
        (levelForCompletion ?? "").trim() &&
        preferredSideForCompletion,
    );

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
        {
          ok: false,
          errorCode: "USERNAME_TAKEN",
          error: "Este username já está a ser utilizado.",
        },
        { status: 409 },
      );
    }
    console.error("[padel/onboarding] erro", err);
    return jsonWrap({ ok: false, errorCode: "INTERNAL_ERROR", error: "Erro inesperado." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
