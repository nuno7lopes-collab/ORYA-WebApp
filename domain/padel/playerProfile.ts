import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function upsertPadelPlayerProfile(params: {
  organizationId: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  level?: string | null;
}) {
  const { organizationId, fullName, email, phone, gender, level } = params;
  if (!fullName.trim()) return;
  const emailClean = email?.trim().toLowerCase() || null;
  const phoneClean = phone?.trim() || null;

  try {
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
  tx: Prisma.TransactionClient,
  params: { organizationId: number; userId: string },
) {
  const { organizationId, userId } = params;
  const existing = await tx.padelPlayerProfile.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  if (existing) return existing.id;
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
  return created.id;
}
