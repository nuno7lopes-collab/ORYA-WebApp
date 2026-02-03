export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { AddressSourceProvider, LocationSource, OrganizationMemberRole, PadelClubKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { PORTUGAL_CITIES } from "@/config/cities";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];
const CLUB_KINDS = new Set(["OWN", "PARTNER"]);

function normalizeSlug(raw: string | null | undefined) {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const pickCanonicalField = (canonical: Prisma.JsonValue | null, ...keys: string[]) => {
  const record = asRecord(canonical);
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

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

const mapAddressProviderToLocationSource = (provider?: AddressSourceProvider | null) => {
  if (!provider || provider === AddressSourceProvider.MANUAL) return LocationSource.MANUAL;
  if (provider === AddressSourceProvider.APPLE_MAPS) return LocationSource.APPLE_MAPS;
  return LocationSource.OSM;
};

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
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: readRoles,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

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
  } = await supabase.auth.getUser();

  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const organizationIdParam = body.organizationId ?? resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const parsedOrgId = parseOrganizationId(organizationIdParam);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: writeRoles,
  });
  if (!organization) return jsonWrap({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const id = typeof body.id === "number" ? body.id : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const addressIdRaw = typeof body.addressId === "string" ? body.addressId.trim() : "";
  const addressIdInput = addressIdRaw || null;
  const kindRaw = typeof body.kind === "string" ? body.kind.trim().toUpperCase() : "";
  const requestedKind = CLUB_KINDS.has(kindRaw) ? kindRaw : null;
  const sourceClubIdRaw =
    typeof body.sourceClubId === "number"
      ? body.sourceClubId
      : typeof body.sourceClubId === "string"
        ? Number(body.sourceClubId)
        : null;
  const courtsCountRaw =
    typeof body.courtsCount === "number"
      ? body.courtsCount
      : typeof body.courtsCount === "string"
        ? Number(body.courtsCount)
        : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
  const slugInput = typeof body.slug === "string" ? normalizeSlug(body.slug) : "";
  const isDefault = typeof body.isDefault === "boolean" ? body.isDefault : false;

  const existing = id
    ? await prisma.padelClub.findFirst({
        where: { id, organizationId: organization.id, deletedAt: null },
        select: {
          id: true,
          name: true,
          addressId: true,
          kind: true,
          sourceClubId: true,
          locationSource: true,
          locationProviderId: true,
          locationFormattedAddress: true,
          locationComponents: true,
          latitude: true,
          longitude: true,
          city: true,
          address: true,
          isDefault: true,
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

  const existingKind = existing?.kind ? String(existing.kind).toUpperCase() : null;
  const kind = ((existingKind && CLUB_KINDS.has(existingKind) ? existingKind : requestedKind) ?? "OWN") as PadelClubKind;
  const isPartner = kind === "PARTNER";
  const sourceClubIdCandidate = Number.isFinite(sourceClubIdRaw as number)
    ? Math.floor(sourceClubIdRaw as number)
    : null;
  const sourceClub = isPartner && sourceClubIdCandidate
    ? await prisma.padelClub.findFirst({
        where: { id: sourceClubIdCandidate, deletedAt: null, isActive: true },
        select: {
          id: true,
          addressId: true,
          locationFormattedAddress: true,
          locationProviderId: true,
          locationComponents: true,
          locationSource: true,
          city: true,
          address: true,
          latitude: true,
          longitude: true,
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

  const resolvedAddressId = addressIdInput ?? sourceClub?.addressId ?? existing?.addressId ?? null;
  if (!resolvedAddressId) {
    return jsonWrap({ ok: false, error: "Seleciona uma morada normalizada antes de guardar." }, { status: 400 });
  }

  const resolvedAddressRecord = await prisma.address.findUnique({
    where: { id: resolvedAddressId },
    select: ADDRESS_SELECT,
  });
  if (!resolvedAddressRecord) {
    return jsonWrap({ ok: false, error: "Morada inválida." }, { status: 400 });
  }

  const resolvedName = name || existing?.name || "";
  const resolvedCity =
    pickCanonicalField(resolvedAddressRecord.canonical ?? null, "city", "addressLine2") ||
    pickCanonicalField(sourceClub?.addressRef?.canonical ?? null, "city", "addressLine2") ||
    "";
  const resolvedAddress =
    resolvedAddressRecord.formattedAddress ||
    pickCanonicalField(resolvedAddressRecord.canonical ?? null, "addressLine1") ||
    pickCanonicalField(sourceClub?.addressRef?.canonical ?? null, "addressLine1") ||
    "";
  const locationSource = mapAddressProviderToLocationSource(resolvedAddressRecord.sourceProvider);
  const locationProviderId = resolvedAddressRecord.sourceProviderPlaceId || null;
  const locationFormattedAddress = resolvedAddressRecord.formattedAddress || null;
  const locationComponents = (resolvedAddressRecord.canonical as Record<string, unknown> | null) ?? null;
  const latitude = resolvedAddressRecord.latitude ?? null;
  const longitude = resolvedAddressRecord.longitude ?? null;

  if (!resolvedName || resolvedName.length < 3) {
    return jsonWrap({ ok: false, error: "Nome do clube é obrigatório." }, { status: 400 });
  }

  if (resolvedCity && !PORTUGAL_CITIES.includes(resolvedCity as (typeof PORTUGAL_CITIES)[number])) {
    return jsonWrap(
      { ok: false, error: "Cidade inválida. Escolhe uma cidade da lista disponível na ORYA." },
      { status: 400 },
    );
  }

  if (!resolvedAddressId) {
    return jsonWrap(
      { ok: false, error: "Seleciona uma morada normalizada antes de guardar." },
      { status: 400 },
    );
  }
  if (!isPartner && !resolvedCity.trim()) {
    return jsonWrap({ ok: false, error: "Cidade obrigatória para clube principal." }, { status: 400 });
  }
  if (!isPartner && !resolvedAddress.trim()) {
    return jsonWrap({ ok: false, error: "Morada obrigatória para clube principal." }, { status: 400 });
  }
  if (isPartner && sourceClubIdRaw && !Number.isFinite(sourceClubIdRaw)) {
    return jsonWrap({ ok: false, error: "Clube parceiro inválido." }, { status: 400 });
  }

  const courtsCount = courtsCountRaw && Number.isFinite(courtsCountRaw)
    ? Math.min(1000, Math.max(1, Math.floor(courtsCountRaw)))
    : 1;
  const baseSlug = slugInput || normalizeSlug(resolvedName);

  const safeIsDefault = !isPartner && isActive ? isDefault : false;

  try {
    if (isPartner && !existing && sourceClubIdCandidate && !sourceClub) {
      return jsonWrap(
        { ok: false, error: "Clube parceiro indisponível ou inexistente." },
        { status: 400 },
      );
    }

    const slug = baseSlug ? await generateUniqueSlug(baseSlug, organization.id, id) : null;
    const sourceClubId = isPartner
      ? sourceClubIdCandidate ?? existing?.sourceClubId ?? null
      : null;

    const updateData: Prisma.PadelClubUncheckedUpdateInput = isPartner && existing
      ? {
          isActive,
          isDefault: false,
        }
      : {
          name: resolvedName,
          shortName: resolvedName,
          city: resolvedCity || null,
          address: resolvedAddress || null,
          addressId: resolvedAddressId,
          courtsCount,
          hours: null,
          favoriteCategoryIds: [] as number[],
          isActive,
          slug: slug || null,
          isDefault: safeIsDefault,
          kind,
          sourceClubId,
          locationSource,
          locationProviderId,
          locationFormattedAddress,
          locationComponents: locationComponents as Prisma.InputJsonValue,
          latitude,
          longitude,
        };
    const createData: Prisma.PadelClubUncheckedCreateInput = {
      organizationId: organization.id,
      name: resolvedName,
      shortName: resolvedName,
      city: resolvedCity || null,
      address: resolvedAddress || null,
      addressId: resolvedAddressId,
      courtsCount,
      hours: null,
      favoriteCategoryIds: [] as number[],
      isActive,
      slug: slug || null,
      isDefault: safeIsDefault,
      kind,
      sourceClubId,
      locationSource,
      locationProviderId,
      locationFormattedAddress,
      locationComponents: locationComponents as Prisma.InputJsonValue,
      latitude,
      longitude,
    };

    const club = await prisma.$transaction(async (tx) => {
      let saved = id
        ? await tx.padelClub.update({
            where: { id, organizationId: organization.id, deletedAt: null },
            data: updateData,
          })
        : await tx.padelClub.create({
            data: createData,
          });

      const allowDefault = !isPartner;
      if (allowDefault && isDefault) {
        await tx.padelClub.updateMany({
          where: { organizationId: organization.id, NOT: { id: saved.id }, isDefault: true, deletedAt: null },
          data: { isDefault: false },
        });
      } else if (allowDefault) {
        // Se não existir nenhum default, garante que o primeiro ativo fica default
        const defaults = await tx.padelClub.count({
          where: { organizationId: organization.id, isDefault: true, deletedAt: null, isActive: true },
        });
        if (defaults === 0 && saved.isActive) {
          saved = await tx.padelClub.update({ where: { id: saved.id }, data: { isDefault: true } });
        }
      }

      if (!saved.isActive && saved.isDefault) {
        saved = await tx.padelClub.update({ where: { id: saved.id }, data: { isDefault: false } });
      }
      if (isPartner && saved.isDefault) {
        saved = await tx.padelClub.update({ where: { id: saved.id }, data: { isDefault: false } });
      }
      return saved;
    });

    return jsonWrap({ ok: true, club }, { status: id ? 200 : 201 });
  } catch (err) {
    console.error("[padel/clubs] error", err);
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return jsonWrap(
        { ok: false, error: "Já existe um clube com este slug/nome. Escolhe outro." },
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
  } = await supabase.auth.getUser();
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

  await prisma.$transaction(async (tx) => {
    await tx.padelClubCourt.deleteMany({ where: { padelClubId: clubId } });
    await tx.padelClubStaff.deleteMany({ where: { padelClubId: clubId } });
    await tx.padelClub.delete({ where: { id: clubId } });
  });

  return jsonWrap({ ok: true, deleted: true }, { status: 200 });
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
