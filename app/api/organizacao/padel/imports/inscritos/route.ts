export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  OrganizationMemberRole,
  PadelPairingPaymentStatus,
  PadelPairingSlotRole,
  PadelPairingSlotStatus,
  PadelPaymentMode,
  PadelPairingStatus,
  PadelRegistrationStatus,
  Prisma,
} from "@prisma/client";
import { read, utils } from "xlsx";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import {
  ACTIVE_PAIRING_REGISTRATION_WHERE,
  mapRegistrationToPairingLifecycle,
  upsertPadelRegistrationForPairing,
} from "@/domain/padelRegistration";
import {
  buildImportPairKey,
  normalizeImportLookup,
  parsePadelImportRows,
  resolveImportBoolean,
  resolveImportIdentifier,
  type PadelImportError,
} from "@/domain/padel/imports";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];

const asString = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return String(value).trim();
};
type ImportSummary = { totalRows: number; validRows: number; errorRows: number; errorCount: number };

const buildSummary = (totalRows: number, validRows: number, errors: PadelImportError[]): ImportSummary => ({
  totalRows,
  validRows,
  errorRows: totalRows - validRows,
  errorCount: errors.length,
});

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = Number(formData.get("eventId"));
  const fallbackCategoryIdRaw = formData.get("fallbackCategoryId");
  const fallbackCategoryId = fallbackCategoryIdRaw ? Number(fallbackCategoryIdRaw) : Number.NaN;
  const fallbackCategoryIdValue =
    Number.isFinite(fallbackCategoryId) && fallbackCategoryId > 0 ? Math.floor(fallbackCategoryId) : null;
  const dryRun = resolveImportBoolean(asString(formData.get("dryRun")), false);
  const file = formData.get("file");
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "MISSING_FILE" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true },
  });
  if (!event?.organizationId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const emailGate = ensureOrganizationEmailVerified(organization);
  if (!emailGate.ok) return NextResponse.json({ ok: false, error: emailGate.error }, { status: 403 });

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    select: { defaultCategoryId: true, advancedSettings: true },
  });
  if (!config) return NextResponse.json({ ok: false, error: "PADEL_CONFIG_MISSING" }, { status: 409 });

  const categoryLinks = await prisma.padelEventCategoryLink.findMany({
    where: { eventId, isEnabled: true },
    include: { category: { select: { id: true, label: true } } },
  });
  const categoryById = new Map<number, { id: number; label: string | null }>();
  const categoryByLabel = new Map<string, number>();
  categoryLinks.forEach((link) => {
    if (!link.category) return;
    categoryById.set(link.category.id, { id: link.category.id, label: link.category.label ?? null });
    if (link.category.label) categoryByLabel.set(normalizeImportLookup(link.category.label), link.category.id);
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = typeof file.name === "string" ? file.name.toLowerCase() : "";
  const fileType = typeof file.type === "string" ? file.type.toLowerCase() : "";
  const isCsv = fileName.endsWith(".csv") || fileType.includes("csv") || fileType === "text/plain";
  const workbook = isCsv
    ? read(buffer.toString("utf8"), { type: "string", raw: false, codepage: 65001 })
    : read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return NextResponse.json({ ok: false, error: "EMPTY_FILE" }, { status: 400 });
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return NextResponse.json({ ok: false, error: "EMPTY_FILE" }, { status: 400 });
  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  if (rows.length === 0) return NextResponse.json({ ok: false, error: "NO_ROWS" }, { status: 400 });

  const {
    rows: parsedRows,
    errors,
    invalidRows,
    nonEmptyRows,
  } = parsePadelImportRows(rows, {
    categoryById,
    categoryByLabel,
    defaultCategoryId: config.defaultCategoryId ?? null,
    fallbackCategoryId: fallbackCategoryIdValue,
  });

  if (nonEmptyRows === 0) {
    return NextResponse.json({ ok: false, error: "NO_ROWS" }, { status: 400 });
  }

  const advanced = (config.advancedSettings as Record<string, unknown>) ?? {};
  const maxEntriesTotal =
    typeof (advanced as { maxEntriesTotal?: unknown }).maxEntriesTotal === "number"
      ? (advanced as { maxEntriesTotal?: number }).maxEntriesTotal
      : null;

  const existingPairings = await prisma.padelPairing.findMany({
    where: {
      eventId,
      pairingStatus: { not: "CANCELLED" },
      ...ACTIVE_PAIRING_REGISTRATION_WHERE,
    },
    select: {
      id: true,
      categoryId: true,
      slots: {
        select: {
          playerProfile: { select: { displayName: true, fullName: true, email: true } },
        },
      },
    },
  });
  const existingKeys = new Set<string>();
  existingPairings.forEach((pairing) => {
    const identifiers = pairing.slots
      .map((slot) => {
        const name = slot.playerProfile?.displayName || slot.playerProfile?.fullName || "";
        const email = slot.playerProfile?.email ?? null;
        return resolveImportIdentifier(name, email);
      })
      .filter(Boolean);
    const key = buildImportPairKey(pairing.categoryId ?? null, identifiers);
    if (key) existingKeys.add(key);
  });

  parsedRows.forEach((row) => {
    const identifiers = row.players.map((player) => resolveImportIdentifier(player.name, player.email));
    const key = buildImportPairKey(row.categoryId, identifiers);
    if (key && existingKeys.has(key)) {
      errors.push({ row: row.rowNumber, message: "Dupla já inscrita neste evento.", field: "pairing" });
      invalidRows.add(row.rowNumber);
    }
  });

  const categoryCounts = new Map<number, number>();
  const categoryPlayerCounts = new Map<number, number>();
  if (parsedRows.some((row) => row.categoryId)) {
    const byCategory = await prisma.padelPairing.groupBy({
      by: ["categoryId"],
      where: {
        eventId,
        pairingStatus: { not: "CANCELLED" },
        ...ACTIVE_PAIRING_REGISTRATION_WHERE,
      },
      _count: { _all: true },
    });
    byCategory.forEach((row) => {
      if (row.categoryId) categoryCounts.set(row.categoryId, row._count._all);
    });

    for (const link of categoryLinks) {
      const categoryId = link.padelCategoryId;
      const capacityPlayers =
        typeof link.capacityPlayers === "number" && link.capacityPlayers > 0 ? Math.floor(link.capacityPlayers) : null;
      if (!capacityPlayers) continue;
      const playersCount = await prisma.padelPairingSlot.count({
        where: {
          slotStatus: "FILLED",
          pairing: {
            eventId,
            categoryId,
            pairingStatus: { not: "CANCELLED" },
            ...ACTIVE_PAIRING_REGISTRATION_WHERE,
          },
        },
      });
      categoryPlayerCounts.set(categoryId, playersCount);
    }
  }

  let eventCount = await prisma.padelPairing.count({
    where: {
      eventId,
      pairingStatus: { not: "CANCELLED" },
      ...ACTIVE_PAIRING_REGISTRATION_WHERE,
    },
  });
  parsedRows
    .filter((row) => !invalidRows.has(row.rowNumber))
    .forEach((row) => {
      if (maxEntriesTotal && Number.isFinite(maxEntriesTotal) && eventCount >= maxEntriesTotal) {
        errors.push({ row: row.rowNumber, message: "Evento cheio. Aumenta o limite total.", field: "event" });
        invalidRows.add(row.rowNumber);
        return;
      }
      const categoryId = row.categoryId;
      if (categoryId) {
        const link = categoryLinks.find((c) => c.padelCategoryId === categoryId);
        const capacityTeams =
          typeof link?.capacityTeams === "number" && link.capacityTeams > 0 ? Math.floor(link.capacityTeams) : null;
        if (capacityTeams) {
          const current = categoryCounts.get(categoryId) ?? 0;
          if (current >= capacityTeams) {
            errors.push({ row: row.rowNumber, message: "Categoria cheia (limite de equipas).", field: "categoria" });
            invalidRows.add(row.rowNumber);
            return;
          }
        }
        const capacityPlayers =
          typeof link?.capacityPlayers === "number" && link.capacityPlayers > 0 ? Math.floor(link.capacityPlayers) : null;
        if (capacityPlayers) {
          const currentPlayers = categoryPlayerCounts.get(categoryId) ?? 0;
          if (currentPlayers + 2 > capacityPlayers) {
            errors.push({ row: row.rowNumber, message: "Categoria cheia (limite de jogadores).", field: "categoria" });
            invalidRows.add(row.rowNumber);
            return;
          }
        }
      }

      eventCount += 1;
      if (categoryId) {
        categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);
        if (categoryPlayerCounts.has(categoryId)) {
          categoryPlayerCounts.set(categoryId, (categoryPlayerCounts.get(categoryId) ?? 0) + 2);
        }
      }
    });

  const validRows = parsedRows.filter((row) => !invalidRows.has(row.rowNumber));
  const summary = buildSummary(nonEmptyRows, validRows.length, errors);

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: "INVALID_ROWS", errors, summary }, { status: 400 });
  }

  if (dryRun) {
    const categorySummary = validRows.reduce<Record<string, number>>((acc, row) => {
      const key = String(row.categoryId ?? "0");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    await recordOrganizationAuditSafe({
      organizationId: organization.id,
      actorUserId: user.id,
      action: "PADEL_IMPORT_VALIDATE",
      metadata: {
        eventId,
        rows: summary.totalRows,
        validRows: summary.validRows,
        categories: categorySummary,
      },
    });
    return NextResponse.json(
      {
        ok: true,
        dryRun: true,
        summary,
        preview: {
          categories: categorySummary,
          validRows: summary.validRows,
        },
      },
      { status: 200 },
    );
  }

  const emails = Array.from(
    new Set(
      parsedRows
        .flatMap((row) => row.players.map((p) => p.email || ""))
        .filter(Boolean)
        .map((email) => email.toLowerCase()),
    ),
  );
  const [authUsers, existingProfilesByEmail] = await Promise.all([
    emails.length > 0
      ? prisma.users.findMany({
          where: { email: { in: emails } },
          select: { id: true, email: true },
        })
      : Promise.resolve([]),
    emails.length > 0
      ? prisma.padelPlayerProfile.findMany({
          where: { organizationId: organization.id, email: { in: emails } },
          select: { id: true, email: true, userId: true, fullName: true },
        })
      : Promise.resolve([]),
  ]);

  const emailToUserId = new Map<string, string>();
  authUsers.forEach((u) => {
    if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
  });

  const emailToPlayerProfile = new Map<string, { id: number; userId: string | null }>();
  existingProfilesByEmail.forEach((p) => {
    if (p.email) emailToPlayerProfile.set(p.email.toLowerCase(), { id: p.id, userId: p.userId ?? null });
  });
  const nameToPlayerProfileId = new Map<string, number>();

  const userIds = Array.from(new Set(authUsers.map((u) => u.id)));
  const profilesByUserId = userIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          fullName: true,
          contactPhone: true,
          gender: true,
          padelLevel: true,
          padelPreferredSide: true,
          padelClubName: true,
        },
      })
    : [];
  const profileByUserId = new Map(profilesByUserId.map((p) => [p.id, p]));

  const ensurePlayerProfile = async (
    tx: Prisma.TransactionClient,
    player: { name: string; email: string | null; phone: string | null },
  ) => {
    const emailKey = player.email ? player.email.toLowerCase() : null;
    const nameKey = player.name.trim().toLowerCase();
    const userId = emailKey ? emailToUserId.get(emailKey) ?? null : null;

    if (userId) {
      const existingForUser = await tx.padelPlayerProfile.findFirst({
        where: { organizationId: organization.id, userId },
        select: { id: true },
      });
      if (existingForUser) return { playerProfileId: existingForUser.id, userId };
      const profile = profileByUserId.get(userId);
      const created = await tx.padelPlayerProfile.create({
        data: {
          organizationId: organization.id,
          userId,
          fullName: profile?.fullName?.trim() || player.name.trim(),
          displayName: profile?.fullName?.trim() || player.name.trim(),
          email: player.email ?? undefined,
          phone: profile?.contactPhone ?? player.phone ?? undefined,
          gender: profile?.gender ?? undefined,
          level: profile?.padelLevel ?? undefined,
          preferredSide: profile?.padelPreferredSide ?? undefined,
          clubName: profile?.padelClubName ?? undefined,
        },
        select: { id: true },
      });
      return { playerProfileId: created.id, userId };
    }

    if (emailKey) {
      const existingByEmail = emailToPlayerProfile.get(emailKey);
      if (existingByEmail) return { playerProfileId: existingByEmail.id, userId: existingByEmail.userId };
    }

    const existingByName = nameToPlayerProfileId.get(nameKey);
    if (existingByName) return { playerProfileId: existingByName, userId: null };

    const created = await tx.padelPlayerProfile.create({
      data: {
        organizationId: organization.id,
        fullName: player.name.trim(),
        displayName: player.name.trim(),
        email: player.email ?? undefined,
        phone: player.phone ?? undefined,
      },
      select: { id: true },
    });
    if (emailKey) emailToPlayerProfile.set(emailKey, { id: created.id, userId: null });
    nameToPlayerProfileId.set(nameKey, created.id);
    return { playerProfileId: created.id, userId: null };
  };

  const seedsToApply = new Map<number, number>();
  const groupsToApply: Record<string, string> = {};

  let createdPairings: Array<{ id: number; group: string | null; seed: number | null }> = [];
  try {
    createdPairings = await prisma.$transaction(async (tx) => {
      const created: Array<{ id: number; group: string | null; seed: number | null }> = [];
      let eventCount = await tx.padelPairing.count({
        where: {
          eventId,
          pairingStatus: { not: "CANCELLED" },
          ...ACTIVE_PAIRING_REGISTRATION_WHERE,
        },
      });

      const categoryCounts = new Map<number, number>();
      const categoryPlayerCounts = new Map<number, number>();
      if (parsedRows.some((row) => row.categoryId)) {
        const byCategory = await tx.padelPairing.groupBy({
          by: ["categoryId"],
          where: {
            eventId,
            pairingStatus: { not: "CANCELLED" },
            ...ACTIVE_PAIRING_REGISTRATION_WHERE,
          },
          _count: { _all: true },
        });
        byCategory.forEach((row) => {
          if (row.categoryId) categoryCounts.set(row.categoryId, row._count._all);
        });

        for (const link of categoryLinks) {
          const categoryId = link.padelCategoryId;
          const capacityPlayers =
            typeof link.capacityPlayers === "number" && link.capacityPlayers > 0 ? Math.floor(link.capacityPlayers) : null;
          if (!capacityPlayers) continue;
          const playersCount = await tx.padelPairingSlot.count({
            where: {
              slotStatus: "FILLED",
              pairing: {
                eventId,
                categoryId,
                pairingStatus: { not: "CANCELLED" },
                ...ACTIVE_PAIRING_REGISTRATION_WHERE,
              },
            },
          });
          categoryPlayerCounts.set(categoryId, playersCount);
        }
      }

      for (const row of parsedRows) {
      if (maxEntriesTotal && Number.isFinite(maxEntriesTotal) && eventCount >= maxEntriesTotal) {
        throw new Error("EVENT_FULL");
      }
      const categoryId = row.categoryId;
      if (categoryId) {
        const link = categoryLinks.find((c) => c.padelCategoryId === categoryId);
        const capacityTeams =
          typeof link?.capacityTeams === "number" && link.capacityTeams > 0 ? Math.floor(link.capacityTeams) : null;
        if (capacityTeams) {
          const current = categoryCounts.get(categoryId) ?? 0;
          if (current >= capacityTeams) {
            throw new Error("CATEGORY_FULL");
          }
        }
        const capacityPlayers =
          typeof link?.capacityPlayers === "number" && link.capacityPlayers > 0 ? Math.floor(link.capacityPlayers) : null;
        if (capacityPlayers) {
          const currentPlayers = categoryPlayerCounts.get(categoryId) ?? 0;
          if (currentPlayers + 2 > capacityPlayers) {
            throw new Error("CATEGORY_PLAYERS_FULL");
          }
        }
      }

      const playerA = await ensurePlayerProfile(tx, row.players[0]);
      const playerB = await ensurePlayerProfile(tx, row.players[1]);
      const registrationStatus = row.paid
        ? PadelRegistrationStatus.CONFIRMED
        : PadelRegistrationStatus.PENDING_PAYMENT;
      const lifecycleStatus = mapRegistrationToPairingLifecycle(registrationStatus, row.paymentMode);
      const pairing = await tx.padelPairing.create({
        data: {
          eventId,
          organizationId: organization.id,
          categoryId,
          payment_mode: row.paymentMode,
          pairingStatus: PadelPairingStatus.COMPLETE,
          lifecycleStatus,
          pairingJoinMode: "INVITE_PARTNER",
          createdByUserId: user.id,
          player1UserId: playerA.userId ?? undefined,
          player2UserId: playerB.userId ?? undefined,
          slots: {
            create: [
              {
                slot_role: PadelPairingSlotRole.CAPTAIN,
                slotStatus: PadelPairingSlotStatus.FILLED,
                paymentStatus: row.paid ? PadelPairingPaymentStatus.PAID : PadelPairingPaymentStatus.UNPAID,
                profileId: playerA.userId ?? undefined,
                playerProfileId: playerA.playerProfileId,
                invitedContact: null,
                isPublicOpen: false,
              },
              {
                slot_role: PadelPairingSlotRole.PARTNER,
                slotStatus: PadelPairingSlotStatus.FILLED,
                paymentStatus: row.paid ? PadelPairingPaymentStatus.PAID : PadelPairingPaymentStatus.UNPAID,
                profileId: playerB.userId ?? undefined,
                playerProfileId: playerB.playerProfileId,
                invitedContact: null,
                isPublicOpen: false,
              },
            ],
          },
        },
        select: { id: true },
      });

      eventCount += 1;
      if (categoryId) {
        categoryCounts.set(categoryId, (categoryCounts.get(categoryId) ?? 0) + 1);
        if (categoryPlayerCounts.has(categoryId)) {
          categoryPlayerCounts.set(categoryId, (categoryPlayerCounts.get(categoryId) ?? 0) + 2);
        }
      }
      created.push({ id: pairing.id, group: row.group, seed: row.seed });
    }

    return created;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "IMPORT_FAILED";
    const error =
      message === "EVENT_FULL" || message === "CATEGORY_FULL" || message === "CATEGORY_PLAYERS_FULL"
        ? message
        : "IMPORT_FAILED";
    return NextResponse.json({ ok: false, error }, { status: 409 });
  }

  createdPairings.forEach((p) => {
    if (typeof p.seed === "number") seedsToApply.set(p.id, p.seed);
    if (p.group) groupsToApply[String(p.id)] = p.group;
  });

  const hasSeeds = seedsToApply.size > 0;
  const hasGroups = Object.keys(groupsToApply).length > 0;
  if (hasSeeds || hasGroups) {
    const mergedAdvanced = { ...advanced } as Record<string, unknown>;
    if (hasSeeds) {
      const existing = (mergedAdvanced.seedRanks as Record<string, number> | undefined) ?? {};
      seedsToApply.forEach((value, key) => {
        existing[String(key)] = value;
      });
      mergedAdvanced.seedRanks = existing;
    }
    if (hasGroups) {
      const existingGroups =
        (mergedAdvanced.groupsConfig as Record<string, unknown> | undefined) ?? {};
      const manualAssignments =
        (existingGroups.manualAssignments as Record<string, string> | undefined) ?? {};
      Object.entries(groupsToApply).forEach(([key, value]) => {
        manualAssignments[key] = value;
      });
      mergedAdvanced.groupsConfig = { ...existingGroups, manualAssignments };
    }
    await prisma.padelTournamentConfig.update({
      where: { eventId },
      data: { advancedSettings: mergedAdvanced },
    });
  }

  await recordOrganizationAuditSafe({
    organizationId: organization.id,
    actorUserId: user.id,
    action: "PADEL_IMPORT_PAIRINGS",
    metadata: {
      eventId,
      count: createdPairings.length,
      seedsApplied: seedsToApply.size,
      groupsApplied: Object.keys(groupsToApply).length,
        },
      });

      await upsertPadelRegistrationForPairing(tx, {
        pairingId: pairing.id,
        organizationId: organization.id,
        eventId,
        status: registrationStatus,
        paymentMode: row.paymentMode,
        isFullyPaid: row.paid,
        reason: "IMPORT",
      });

  return NextResponse.json(
    {
      ok: true,
      imported: {
        pairings: createdPairings.length,
        seedsApplied: seedsToApply.size,
        groupsApplied: Object.keys(groupsToApply).length,
      },
    },
    { status: 200 },
  );
}
