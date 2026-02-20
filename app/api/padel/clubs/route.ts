export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import {
  OrganizationMemberRole,
  OrganizationModule,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { deactivateReservationResourcesForCourts } from "@/lib/reservas/courtResourceLink";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

function normalizeSlug(raw: string | null | undefined) {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}


const ADDRESS_SELECT = {
  id: true,
  formattedAddress: true,
  canonical: true,
  latitude: true,
  longitude: true,
  sourceProvider: true,
  sourceProviderPlaceId: true,
  confidenceScore: true,
  validationStatus: true,
} satisfies Prisma.AddressSelect;


async function generateUniqueSlug(base: string, organizationId: number, excludeId?: number | null) {
  if (!base) return "";
  let candidate = base;
  let suffix = 2;
  // Garante slug único por organização; acrescenta -2, -3, ...
  // Usa findFirst case-insensitive para evitar conflitos.
  while (true) {
    const exists = await prisma.padelClub.findFirst({
      where: {
        organizationId,
        slug: { equals: candidate, mode: "insensitive" },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: readRoles,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  const viewPermission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!viewPermission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const items = await prisma.padelClub.findMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: {
      addressRef: {
        select: {
          id: true,
          formattedAddress: true,
          canonical: true,
          latitude: true,
          longitude: true,
          sourceProvider: true,
          sourceProviderPlaceId: true,
        },
      },
    },
  });

  return jsonWrap({ ok: true, items }, { status: 200 });
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const organizationIdParam = body.organizationId ?? resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const parsedOrgId = parseOrganizationId(organizationIdParam);
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: writeRoles,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  const editPermission = await ensureMemberModuleAccess({
    organizationId: organization.id,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!editPermission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const id = typeof body.id === "number" ? body.id : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const addressIdRaw = typeof body.addressId === "string" ? body.addressId.trim() : "";
  const addressIdInput = addressIdRaw || null;
  const courtsCountRaw =
    typeof body.courtsCount === "number"
      ? body.courtsCount
      : typeof body.courtsCount === "string"
        ? Number(body.courtsCount)
        : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  const existing = id
    ? await prisma.padelClub.findFirst({
        where: { id, organizationId: organization.id, deletedAt: null },
        select: {
          id: true,
          name: true,
          addressId: true,
          isActive: true,
          addressRef: {
            select: {
              formattedAddress: true,
              canonical: true,
              latitude: true,
              longitude: true,
              sourceProvider: true,
              sourceProviderPlaceId: true,
            },
          },
        },
      })
    : null;
  if (id && !existing) {
    return jsonWrap({ ok: false, error: "Clube não encontrado." }, { status: 404 });
  }

  if (!existing) {
    const organizationClub = await prisma.padelClub.findFirst({
      where: {
        organizationId: organization.id,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (organizationClub) {
      return jsonWrap(
        { ok: false, error: "A organização já tem um clube. Edita o clube existente." },
        { status: 409 },
      );
    }
  }

  const resolvedAddressId = addressIdInput ?? existing?.addressId ?? null;
  if (!resolvedAddressId) {
    return jsonWrap({ ok: false, error: "Seleciona uma morada antes de guardar." }, { status: 400 });
  }

  const resolvedAddressRecord = await prisma.address.findUnique({
    where: { id: resolvedAddressId },
    select: ADDRESS_SELECT,
  });
  if (!resolvedAddressRecord) {
    return jsonWrap({ ok: false, error: "Morada inválida." }, { status: 400 });
  }

  const resolvedName = name || existing?.name || "";

  if (!resolvedName || resolvedName.length < 3) {
    return jsonWrap({ ok: false, error: "Nome do clube é obrigatório." }, { status: 400 });
  }

  const courtsCount = courtsCountRaw && Number.isFinite(courtsCountRaw)
    ? Math.min(1000, Math.max(1, Math.floor(courtsCountRaw)))
    : 1;
  const baseSlug = normalizeSlug(resolvedName);

  try {
    const slug = baseSlug ? await generateUniqueSlug(baseSlug, organization.id, id) : null;
    const updateData: Prisma.PadelClubUncheckedUpdateInput = {
      name: resolvedName,
      shortName: resolvedName,
      addressId: resolvedAddressId,
      courtsCount,
      hours: null,
      favoriteCategoryIds: [] as number[],
      isActive,
      slug: slug || null,
      kind: "OWN",
      sourceClubId: null,
    };
    const createData: Prisma.PadelClubUncheckedCreateInput = {
      organizationId: organization.id,
      name: resolvedName,
      shortName: resolvedName,
      addressId: resolvedAddressId,
      courtsCount,
      hours: null,
      favoriteCategoryIds: [] as number[],
      isActive,
      slug: slug || null,
      kind: "OWN",
      sourceClubId: null,
    };

    const club = await prisma.$transaction(async (tx) => {
      const saved = id
        ? await tx.padelClub.update({
            where: { id, organizationId: organization.id, deletedAt: null },
            data: updateData,
          })
        : await tx.padelClub.create({
            data: createData,
          });
      return saved;
    });

    return jsonWrap(
      {
        ok: true,
        club,
        partnerCourtSync: null,
      },
      { status: id ? 200 : 201 },
    );
  } catch (err) {
    console.error("[padel/clubs] error", err);
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return jsonWrap(
        { ok: false, error: "Já existe um clube com este nome. Escolhe outro." },
        { status: 409 },
      );
    }
    const msg =
      err instanceof Error && err.message.includes("Record to update not found")
        ? "Clube não encontrado."
        : "Erro ao gravar clube.";
    const status = msg === "Clube não encontrado." ? 404 : 500;
    return jsonWrap({ ok: false, error: msg }, { status });
  }
}

// Soft delete club (marks isActive=false, deletedAt now)
async function _DELETE(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const url = new URL(req.url);
  const idParam = url.searchParams.get("id");
  const clubId = idParam ? Number(idParam) : NaN;
  const orgId = resolveOrganizationIdFromParams(url.searchParams);

  if (!Number.isFinite(clubId)) return jsonWrap({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: orgId ?? undefined,
    roles: writeRoles,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const club = await prisma.padelClub.findFirst({
    where: { id: clubId, organizationId: organization.id, deletedAt: null },
  });
  if (!club) return jsonWrap({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });

  const tournamentRefs = await prisma.padelTournamentConfig.count({
    where: {
      organizationId: organization.id,
      OR: [{ padelClubId: clubId }, { partnerClubIds: { has: clubId } }],
    },
  });
  if (tournamentRefs > 0) {
    return jsonWrap(
      { ok: false, error: "Não podes apagar um clube associado a torneios. Remove-o dessas provas primeiro." },
      { status: 400 },
    );
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const courtIds = await tx.padelClubCourt.findMany({
      where: { padelClubId: clubId, deletedAt: null },
      select: { id: true },
    });
    await tx.padelClubCourt.updateMany({
      where: { padelClubId: clubId, deletedAt: null },
      data: { isActive: false, deletedAt: now },
    });
    await deactivateReservationResourcesForCourts({
      db: tx,
      courtIds: courtIds.map((court) => court.id),
    });
    await tx.padelClubStaff.updateMany({
      where: { padelClubId: clubId, deletedAt: null },
      data: { isActive: false, deletedAt: now },
    });
    const saved = await tx.padelClub.update({
      where: { id: clubId },
      data: { isActive: false, deletedAt: now },
    });

    return saved;
  });

  return jsonWrap({ ok: true, deleted: true, club: updated }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
