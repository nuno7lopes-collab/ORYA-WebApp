import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function upsertPadelPlayerProfile(params: {
  organizationId: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  level?: string | null;
  userId?: string | null;
}) {
  const { organizationId, fullName, email, phone, gender, level, userId } = params;
  const emailClean = email?.trim().toLowerCase() || null;
  const phoneClean = phone?.trim() || null;

  try {
    let resolvedUserId = userId ?? null;
    if (!resolvedUserId && emailClean) {
      const matchedUser = await prisma.users.findFirst({
        where: { email: emailClean },
        select: { id: true },
      });
      resolvedUserId = matchedUser?.id ?? null;
    }

    if (resolvedUserId) {
      const [profile, authUser] = await Promise.all([
        prisma.profile.findUnique({
          where: { id: resolvedUserId },
          select: { fullName: true, contactPhone: true, gender: true, padelLevel: true },
        }),
        prisma.users.findUnique({ where: { id: resolvedUserId }, select: { email: true } }),
      ]);
      const resolvedName = fullName.trim() || profile?.fullName?.trim() || "Jogador Padel";
      const resolvedEmail = (emailClean || authUser?.email) ?? null;
      const resolvedPhone = (phoneClean || profile?.contactPhone) ?? null;

      const existing = await prisma.padelPlayerProfile.findFirst({
        where: { organizationId, userId: resolvedUserId },
        select: { id: true },
      });

      if (existing?.id) {
        await prisma.padelPlayerProfile.update({
          where: { id: existing.id },
          data: {
            fullName: resolvedName,
            displayName: resolvedName,
            email: resolvedEmail || undefined,
            phone: resolvedPhone ?? undefined,
            gender: gender ?? profile?.gender ?? undefined,
            level: level ?? profile?.padelLevel ?? undefined,
          },
        });
        await prisma.crmCustomer.upsert({
          where: { organizationId_userId: { organizationId, userId: resolvedUserId } },
          update: {
            ...(resolvedName ? { displayName: resolvedName } : {}),
            ...(resolvedEmail ? { contactEmail: resolvedEmail } : {}),
            ...(resolvedPhone ? { contactPhone: resolvedPhone } : {}),
          },
          create: {
            organizationId,
            userId: resolvedUserId,
            status: "ACTIVE",
            displayName: resolvedName || undefined,
            contactEmail: resolvedEmail || undefined,
            contactPhone: resolvedPhone ?? undefined,
          },
        });
        return;
      }

      await prisma.padelPlayerProfile.create({
        data: {
          organizationId,
          userId: resolvedUserId,
          fullName: resolvedName,
          displayName: resolvedName,
          email: resolvedEmail || undefined,
          phone: resolvedPhone ?? undefined,
          gender: gender ?? profile?.gender ?? undefined,
          level: level ?? profile?.padelLevel ?? undefined,
        },
      });
      await prisma.crmCustomer.upsert({
        where: { organizationId_userId: { organizationId, userId: resolvedUserId } },
        update: {
          ...(resolvedName ? { displayName: resolvedName } : {}),
          ...(resolvedEmail ? { contactEmail: resolvedEmail } : {}),
          ...(resolvedPhone ? { contactPhone: resolvedPhone } : {}),
        },
        create: {
          organizationId,
          userId: resolvedUserId,
          status: "ACTIVE",
          displayName: resolvedName || undefined,
          contactEmail: resolvedEmail || undefined,
          contactPhone: resolvedPhone ?? undefined,
        },
      });
      return;
    }

    if (!fullName.trim()) return;

    const existing = emailClean
      ? await prisma.padelPlayerProfile.findFirst({
          where: { organizationId, email: emailClean },
          select: { id: true },
        })
      : null;

    if (existing?.id) {
      await prisma.padelPlayerProfile.update({
        where: { id: existing.id },
        data: {
          fullName,
          phone: phoneClean ?? undefined,
          gender: gender ?? undefined,
          level: level ?? undefined,
        },
      });
      return;
    }

    await prisma.padelPlayerProfile.create({
      data: {
        organizationId,
        fullName,
        email: emailClean || undefined,
        phone: phoneClean ?? undefined,
        gender: gender ?? undefined,
        level: level ?? undefined,
      },
    });
  } catch (err) {
    console.warn("[padel] upsertPadelPlayerProfile falhou (ignorado)", err);
  }
}

export async function ensurePadelPlayerProfileId(
  tx: Prisma.TransactionClient | PrismaClient,
  params: { organizationId: number; userId: string },
) {
  const { organizationId, userId } = params;
  const existing = await tx.padelPlayerProfile.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  if (existing) {
    await tx.crmCustomer.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      update: {},
      create: {
        organizationId,
        userId,
        status: "ACTIVE",
      },
    });
    return existing.id;
  }
  const [profile, authUser] = await Promise.all([
    tx.profile.findUnique({
      where: { id: userId },
      select: {
        fullName: true,
        contactPhone: true,
        gender: true,
        padelLevel: true,
        padelPreferredSide: true,
        padelClubName: true,
      },
    }),
    tx.users.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  const name = profile?.fullName?.trim() || "Jogador Padel";
  const email = authUser?.email ?? null;
  const created = await tx.padelPlayerProfile.create({
    data: {
      organizationId,
      userId,
      fullName: name,
      displayName: name,
      email: email ?? undefined,
      phone: profile?.contactPhone ?? undefined,
      gender: profile?.gender ?? undefined,
      level: profile?.padelLevel ?? undefined,
      preferredSide: profile?.padelPreferredSide ?? undefined,
      clubName: profile?.padelClubName ?? undefined,
    },
    select: { id: true },
  });
  await tx.crmCustomer.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: {
      ...(name ? { displayName: name } : {}),
      ...(email ? { contactEmail: email } : {}),
      ...(profile?.contactPhone ? { contactPhone: profile.contactPhone } : {}),
    },
    create: {
      organizationId,
      userId,
      status: "ACTIVE",
      displayName: name || undefined,
      contactEmail: email || undefined,
      contactPhone: profile?.contactPhone ?? undefined,
    },
  });
  return created.id;
}
