export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Gender, OrganizationMemberRole, OrganizationModule, PadelPreferredSide, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  const permission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const players = await prisma.padelPlayerProfile.findMany({
    where: { organizationId: organization.id },
    orderBy: [{ createdAt: "desc" }],
  });

  const userIds = Array.from(
    new Set(players.map((player) => player.userId).filter((id): id is string => Boolean(id))),
  );

  const [profiles, crmCustomers] = userIds.length
    ? await Promise.all([
        prisma.profile.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
            contactPhone: true,
            gender: true,
            padelLevel: true,
            padelPreferredSide: true,
            padelClubName: true,
            users: { select: { email: true } },
          },
        }),
        prisma.crmCustomer.findMany({
          where: { organizationId: organization.id, userId: { in: userIds } },
          select: {
            id: true,
            userId: true,
            status: true,
            tags: true,
            totalSpentCents: true,
            totalTournaments: true,
            lastActivityAt: true,
            marketingOptIn: true,
            displayName: true,
            contactEmail: true,
            contactPhone: true,
          },
        }),
      ])
    : [[], []];

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const crmMap = new Map(crmCustomers.map((customer) => [customer.userId, customer]));
  const profileIds = players.map((player) => player.id);

  const pairingSlots = profileIds.length
    ? await prisma.padelPairingSlot.findMany({
        where: { playerProfileId: { in: profileIds } },
        select: { playerProfileId: true, pairingId: true },
      })
    : [];

  const pairingCounts = profileIds.length
    ? await prisma.padelPairingSlot.groupBy({
        by: ["playerProfileId"],
        where: { playerProfileId: { in: profileIds } },
        _count: { _all: true },
      })
    : [];

  const pairingCountMap = new Map<number, number>();
  pairingCounts.forEach((row) => {
    if (row.playerProfileId == null) return;
    pairingCountMap.set(row.playerProfileId, row._count._all ?? 0);
  });

  const pairingToPlayers = new Map<number, number[]>();
  pairingSlots.forEach((slot) => {
    if (!slot.pairingId || !slot.playerProfileId) return;
    const list = pairingToPlayers.get(slot.pairingId) ?? [];
    list.push(slot.playerProfileId);
    pairingToPlayers.set(slot.pairingId, list);
  });

  const pairingIds = Array.from(pairingToPlayers.keys());
  const noShowCounts = new Map<number, number>();

  if (pairingIds.length > 0) {
    const walkoverMatches = await prisma.eventMatchSlot.findMany({
      where: {
        status: "DONE",
        OR: [{ pairingAId: { in: pairingIds } }, { pairingBId: { in: pairingIds } }],
      },
      select: { pairingAId: true, pairingBId: true, score: true },
    });

    walkoverMatches.forEach((match) => {
      const score = match.score && typeof match.score === "object" ? (match.score as Record<string, unknown>) : {};
      const resultType = typeof score.resultType === "string" ? score.resultType : null;
      const isWalkover = score.walkover === true || resultType === "WALKOVER";
      if (!isWalkover) return;
      const winnerSide = typeof score.winnerSide === "string" ? score.winnerSide : null;
      if (winnerSide !== "A" && winnerSide !== "B") return;
      const loserPairingId = winnerSide === "A" ? match.pairingBId : match.pairingAId;
      if (!loserPairingId) return;
      const playersInPairing = pairingToPlayers.get(loserPairingId) ?? [];
      playersInPairing.forEach((playerProfileId) => {
        noShowCounts.set(playerProfileId, (noShowCounts.get(playerProfileId) ?? 0) + 1);
      });
    });
  }

  const items = players.map((player) => {
    if (!player.userId) {
      return {
        ...player,
        gender: player.gender ?? null,
        level: player.level ?? null,
        tournamentsCount: pairingCountMap.get(player.id) ?? 0,
        noShowCount: noShowCounts.get(player.id) ?? 0,
        profile: null,
        crm: null,
      };
    }
    const profile = profileMap.get(player.userId) ?? null;
    const crm = crmMap.get(player.userId) ?? null;
    const pairingCount = pairingCountMap.get(player.id) ?? 0;
    const crmTotal = crm?.totalTournaments ?? 0;
    const tournamentsCount = Math.max(pairingCount, crmTotal);
    const resolvedFullName = crm?.displayName ?? profile?.fullName ?? player.fullName;
    const resolvedEmail = crm?.contactEmail ?? profile?.users?.email ?? player.email ?? null;
    const resolvedPhone = crm?.contactPhone ?? profile?.contactPhone ?? player.phone ?? null;
    return {
      ...player,
      fullName: resolvedFullName || player.fullName,
      email: resolvedEmail,
      phone: resolvedPhone,
      gender: profile?.gender ?? player.gender ?? null,
      level: profile?.padelLevel ?? player.level ?? null,
      tournamentsCount,
      noShowCount: noShowCounts.get(player.id) ?? 0,
      preferredSide: profile?.padelPreferredSide ?? player.preferredSide ?? null,
      clubName: profile?.padelClubName ?? player.clubName ?? null,
      profile: profile
        ? {
          id: profile.id,
          username: profile.username,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
        }
      : null,
      crm: crm
        ? {
            id: crm.id,
            status: crm.status,
            tags: crm.tags,
            totalSpentCents: crm.totalSpentCents,
            totalTournaments: crm.totalTournaments,
            lastActivityAt: crm.lastActivityAt,
            marketingOptIn: crm.marketingOptIn,
          }
        : null,
    };
  });

  return jsonWrap({ ok: true, items }, { status: 200 });
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const organizationIdParam = body.organizationId ?? resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const parsedOrgId = parseOrganizationId(organizationIdParam);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  const permission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : fullName;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const genderRaw = typeof body.gender === "string" ? body.gender.trim().toUpperCase() : null;
  const gender =
    genderRaw && Object.values(Gender).includes(genderRaw as Gender) ? (genderRaw as Gender) : null;
  const level = typeof body.level === "string" ? body.level.trim() : null;
  const preferredSideRaw = typeof body.preferredSide === "string" ? body.preferredSide.trim().toUpperCase() : null;
  const preferredSide =
    preferredSideRaw && Object.values(PadelPreferredSide).includes(preferredSideRaw as PadelPreferredSide)
      ? (preferredSideRaw as PadelPreferredSide)
      : null;
  const clubName = typeof body.clubName === "string" ? body.clubName.trim() : null;
  const birthDate = typeof body.birthDate === "string" && body.birthDate.trim() ? new Date(body.birthDate) : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;

  if (!fullName) return jsonWrap({ ok: false, error: "FULLNAME_REQUIRED" }, { status: 400 });

  const userIdInput = typeof body.userId === "string" ? body.userId.trim() : null;

  try {
    let resolvedUserId = userIdInput;
    if (!resolvedUserId && email) {
      const matchedUser = await prisma.users.findFirst({
        where: { email },
        select: { id: true },
      });
      resolvedUserId = matchedUser?.id ?? null;
    }

    if (resolvedUserId) {
      const profileUpdate: Prisma.ProfileUpdateInput = {};
      if (fullName) profileUpdate.fullName = fullName;
      if (phone) profileUpdate.contactPhone = phone;
      if (gender) profileUpdate.gender = gender;
      if (level) profileUpdate.padelLevel = level;
      if (preferredSide) profileUpdate.padelPreferredSide = preferredSide;
      if (clubName) profileUpdate.padelClubName = clubName;
      if (Object.keys(profileUpdate).length > 0) {
        await prisma.profile.update({
          where: { id: resolvedUserId },
          data: profileUpdate,
        });
      }

      await prisma.crmCustomer.upsert({
        where: {
          organizationId_userId: { organizationId: organization.id, userId: resolvedUserId },
        },
        update: {
          ...(displayName || fullName ? { displayName: displayName || fullName } : {}),
          ...(email ? { contactEmail: email } : {}),
          ...(phone ? { contactPhone: phone } : {}),
        },
        create: {
          organizationId: organization.id,
          userId: resolvedUserId,
          displayName: displayName || fullName || undefined,
          contactEmail: email || undefined,
          contactPhone: phone || undefined,
        },
      });

      const profile = await prisma.profile.findUnique({
        where: { id: resolvedUserId },
        select: { fullName: true },
      });
      const nameForPlayer = fullName || profile?.fullName || displayName || "Jogador Padel";

      const existing = await prisma.padelPlayerProfile.findFirst({
        where: { organizationId: organization.id, userId: resolvedUserId },
        select: { id: true },
      });

      const player = existing?.id
        ? await prisma.padelPlayerProfile.update({
            where: { id: existing.id },
            data: {
              fullName: nameForPlayer,
              displayName: displayName || nameForPlayer,
              email: email || undefined,
              phone: phone || undefined,
              gender: gender || undefined,
              level: level || undefined,
              preferredSide: preferredSide || undefined,
              clubName: clubName || undefined,
              isActive,
              notes: notes || undefined,
              birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : undefined,
            },
          })
        : await prisma.padelPlayerProfile.create({
            data: {
              organizationId: organization.id,
              userId: resolvedUserId,
              fullName: nameForPlayer,
              displayName: displayName || nameForPlayer,
              email: email || undefined,
              phone: phone || undefined,
              gender: gender || undefined,
              level: level || undefined,
              preferredSide: preferredSide || undefined,
              clubName: clubName || undefined,
              isActive,
              notes: notes || undefined,
              birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : undefined,
            },
          });

      return jsonWrap({ ok: true, player }, { status: existing?.id ? 200 : 201 });
    }

    const player = email
      ? await (async () => {
          const existing = await prisma.padelPlayerProfile.findFirst({
            where: { organizationId: organization.id, email },
            select: { id: true },
          });
          if (existing?.id) {
            return prisma.padelPlayerProfile.update({
              where: { id: existing.id },
              data: {
                fullName,
                displayName: displayName || fullName,
                phone,
                gender: gender ?? undefined,
                level,
                isActive,
                notes: notes || undefined,
                preferredSide: preferredSide || undefined,
                clubName: clubName || undefined,
                birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : undefined,
              },
            });
          }
          return prisma.padelPlayerProfile.create({
            data: {
              organizationId: organization.id,
              fullName,
              displayName: displayName || fullName,
              email,
              phone,
              gender: gender ?? undefined,
              level,
              isActive,
              notes: notes || undefined,
              preferredSide: preferredSide || undefined,
              clubName: clubName || undefined,
              birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : undefined,
            },
          });
        })()
      : await prisma.padelPlayerProfile.create({
          data: {
            organizationId: organization.id,
            fullName,
            displayName: displayName || fullName,
            phone,
            gender: gender ?? undefined,
            level,
            isActive,
            notes: notes || undefined,
            preferredSide: preferredSide || undefined,
            clubName: clubName || undefined,
            birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : undefined,
          },
        });

    return jsonWrap({ ok: true, player }, { status: 201 });
  } catch (err) {
    console.error("[padel/players][POST]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
