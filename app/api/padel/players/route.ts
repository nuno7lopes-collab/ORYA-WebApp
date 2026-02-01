export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Gender, OrganizationMemberRole, PadelPreferredSide, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
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
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

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

  const items = players.map((player) => {
    if (!player.userId) {
      return {
        ...player,
        profile: null,
        crm: null,
      };
    }
    const profile = profileMap.get(player.userId) ?? null;
    const crm = crmMap.get(player.userId) ?? null;
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
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

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
