export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { Gender, PadelEligibilityType } from "@prisma/client";
import { validateEligibility } from "@/domain/padelEligibility";
import { validatePadelCategoryGender } from "@/domain/padelCategoryGender";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";

// Lista pairings Padel v2 associados ao utilizador (captão ou slot preenchido).
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventIdParam = req.nextUrl.searchParams.get("eventId");
  const eventId = eventIdParam ? Number(eventIdParam) : null;

  try {
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        username: true,
        gender: true,
        contactPhone: true,
        fullName: true,
        padelLevel: true,
        padelPreferredSide: true,
        padelClubName: true,
      },
    });
    const email = user.email?.trim() || null;
    const username = profile?.username?.trim() || null;
    const invitedContacts = [email, username, username ? `@${username}` : null].filter(Boolean) as string[];

    const invitedContactFilters = invitedContacts.map((value) => ({
      invitedContact: { equals: value, mode: "insensitive" as const },
    }));

    const pairings = await prisma.padelPairing.findMany({
      where: {
        ...(eventId ? { eventId } : {}),
        OR: [
          { createdByUserId: user.id },
          { slots: { some: { profileId: user.id } } },
          {
            slots: {
              some: {
                invitedUserId: user.id,
                slotStatus: "PENDING",
                profileId: null,
              },
            },
          },
          ...(invitedContacts.length
            ? [
                {
                  slots: {
                    some: {
                      OR: invitedContactFilters,
                      slotStatus: "PENDING",
                      profileId: null,
                    },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        slots: {
          include: {
            ticket: {
              select: { id: true, status: true, stripePaymentIntentId: true },
            },
          },
        },
        event: {
          select: { id: true, title: true, slug: true, organizationId: true, templateType: true },
        },
        category: { select: { label: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const eventIds = Array.from(new Set(pairings.map((p) => p.eventId)));
    const categoryIds = Array.from(new Set(pairings.map((p) => p.categoryId).filter(Boolean))) as number[];
    const captainIds = Array.from(
      new Set(pairings.map((p) => p.player1UserId).filter((id): id is string => Boolean(id))),
    );

    const [configs, categories, captains] = await Promise.all([
      eventIds.length
        ? prisma.padelTournamentConfig.findMany({
            where: { eventId: { in: eventIds } },
            select: { eventId: true, eligibilityType: true },
          })
        : Promise.resolve([]),
      categoryIds.length
        ? prisma.padelCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true, genderRestriction: true },
          })
        : Promise.resolve([]),
      captainIds.length
        ? prisma.profile.findMany({
            where: { id: { in: captainIds } },
            select: { id: true, gender: true },
          })
        : Promise.resolve([]),
    ]);

    const configByEventId = new Map(configs.map((c) => [c.eventId, c]));
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const captainById = new Map(captains.map((c) => [c.id, c]));

    const onboardingMissing = getPadelOnboardingMissing({
      profile,
      email,
    });
    const onboardingComplete = isPadelOnboardingComplete(onboardingMissing);
    const mapped = pairings.map(({ payment_mode, partnerInviteToken, slots, ...rest }) => {
      const mappedSlots = slots.map(({ slot_role, ...slotRest }) => ({
        ...slotRest,
        slotRole: slot_role,
      }));
      const partnerSlot = slots.find((s) => s.slot_role === "PARTNER" && s.slotStatus === "PENDING");
      const isInviteTarget =
        Boolean(
          partnerSlot &&
            ((partnerSlot.invitedUserId && partnerSlot.invitedUserId === user.id) ||
              (partnerSlot.invitedContact &&
                invitedContacts.some((value) => value.toLowerCase() === partnerSlot.invitedContact?.toLowerCase()))),
        );

      let inviteEligibility: { ok: boolean; reason?: string; missing?: Record<string, boolean> } | null = null;
      if (isInviteTarget && partnerSlot) {
        if (!onboardingComplete) {
          inviteEligibility = { ok: false, reason: "PADEL_ONBOARDING_REQUIRED", missing: onboardingMissing };
        } else {
          const config = configByEventId.get(rest.eventId);
          const captainGender = rest.player1UserId ? captainById.get(rest.player1UserId)?.gender ?? null : null;
          const eligibility = validateEligibility(
            (config?.eligibilityType as PadelEligibilityType) ?? PadelEligibilityType.OPEN,
            (captainGender as Gender | null) ?? null,
            (profile?.gender as Gender | null) ?? null,
          );
          if (!eligibility.ok) {
            inviteEligibility = { ok: false, reason: eligibility.code };
          } else {
            const category = rest.categoryId ? categoryById.get(rest.categoryId) ?? null : null;
            const categoryGender = validatePadelCategoryGender(
              category?.genderRestriction ?? null,
              (captainGender as Gender | null) ?? null,
              (profile?.gender as Gender | null) ?? null,
            );
            if (!categoryGender.ok) {
              inviteEligibility = { ok: false, reason: categoryGender.code };
            } else {
              inviteEligibility = { ok: true };
            }
          }
        }
      }

      return {
        ...rest,
        paymentMode: payment_mode,
        inviteToken: partnerInviteToken,
        slots: mappedSlots,
        inviteEligibility,
      };
    });
    return NextResponse.json({ ok: true, pairings: mapped }, { status: 200 });
  } catch (err) {
    console.error("[padel/pairings/my] query error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
