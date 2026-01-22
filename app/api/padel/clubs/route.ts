export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId, resolveOrganizationIdFromParams } from "@/lib/organizationId";
import { PORTUGAL_CITIES } from "@/config/cities";

const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];
const CLUB_KINDS = new Set(["OWN", "PARTNER"]);
const LOCATION_SOURCES = new Set(["OSM", "MANUAL"]);

function normalizeSlug(raw: string | null | undefined) {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

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

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const parsedOrgId = resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: readRoles,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const items = await prisma.padelClub.findMany({
    where: {
      organizationId: organization.id,
      deletedAt: null,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ ok: true, items }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const organizationIdParam = body.organizationId ?? resolveOrganizationIdFromParams(req.nextUrl.searchParams);
  const parsedOrgId = parseOrganizationId(organizationIdParam);
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: writeRoles,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const id = typeof body.id === "number" ? body.id : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const kindRaw = typeof body.kind === "string" ? body.kind.trim().toUpperCase() : "";
  const requestedKind = CLUB_KINDS.has(kindRaw) ? kindRaw : null;
  const sourceClubIdRaw =
    typeof body.sourceClubId === "number"
      ? body.sourceClubId
      : typeof body.sourceClubId === "string"
        ? Number(body.sourceClubId)
        : null;
  const locationSourceRaw = typeof body.locationSource === "string" ? body.locationSource.trim().toUpperCase() : "";
  const locationSourceInput = LOCATION_SOURCES.has(locationSourceRaw) ? locationSourceRaw : null;
  const locationProviderIdRaw = typeof body.locationProviderId === "string" ? body.locationProviderId.trim() : "";
  const locationFormattedAddressRaw =
    typeof body.locationFormattedAddress === "string" ? body.locationFormattedAddress.trim() : "";
  const locationComponentsRaw =
    body.locationComponents && typeof body.locationComponents === "object" && !Array.isArray(body.locationComponents)
      ? (body.locationComponents as Record<string, unknown>)
      : null;
  const latitudeRaw =
    typeof body.latitude === "number"
      ? body.latitude
      : typeof body.latitude === "string"
        ? Number(body.latitude)
        : null;
  const longitudeRaw =
    typeof body.longitude === "number"
      ? body.longitude
      : typeof body.longitude === "string"
        ? Number(body.longitude)
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
          city: true,
          address: true,
          kind: true,
          sourceClubId: true,
          locationSource: true,
          locationProviderId: true,
          locationFormattedAddress: true,
          locationComponents: true,
          latitude: true,
          longitude: true,
          isDefault: true,
          isActive: true,
        },
      })
    : null;
  if (id && !existing) {
    return NextResponse.json({ ok: false, error: "Clube não encontrado." }, { status: 404 });
  }

  const existingKind = existing?.kind ? String(existing.kind).toUpperCase() : null;
  const kind = (existingKind && CLUB_KINDS.has(existingKind) ? existingKind : requestedKind) ?? "OWN";
  const isPartner = kind === "PARTNER";
  const resolvedName = name || existing?.name || "";
  const resolvedCity = city || existing?.city || "";
  const resolvedAddress = address || existing?.address || "";
  const locationSource =
    (locationSourceInput ?? (existing?.locationSource ? String(existing.locationSource).toUpperCase() : null)) ??
    (isPartner ? "MANUAL" : "OSM");
  const locationProviderId = locationProviderIdRaw || existing?.locationProviderId || null;
  const composedFormatted = [resolvedAddress, resolvedCity].filter(Boolean).join(", ");
  const locationFormattedAddress =
    locationFormattedAddressRaw || composedFormatted || existing?.locationFormattedAddress || null;
  const locationComponents = locationComponentsRaw ?? existing?.locationComponents ?? null;
  const latitude =
    typeof latitudeRaw === "number" && Number.isFinite(latitudeRaw) ? latitudeRaw : existing?.latitude ?? null;
  const longitude =
    typeof longitudeRaw === "number" && Number.isFinite(longitudeRaw) ? longitudeRaw : existing?.longitude ?? null;

  if (!resolvedName || resolvedName.length < 3) {
    return NextResponse.json({ ok: false, error: "Nome do clube é obrigatório." }, { status: 400 });
  }

  if (resolvedCity && !PORTUGAL_CITIES.includes(resolvedCity as (typeof PORTUGAL_CITIES)[number])) {
    return NextResponse.json(
      { ok: false, error: "Cidade inválida. Escolhe uma cidade da lista disponível na ORYA." },
      { status: 400 },
    );
  }

  if (!isPartner && !resolvedCity.trim()) {
    return NextResponse.json({ ok: false, error: "Cidade obrigatória para clube principal." }, { status: 400 });
  }
  if (!isPartner && !resolvedAddress.trim()) {
    return NextResponse.json({ ok: false, error: "Morada obrigatória para clube principal." }, { status: 400 });
  }
  if (!isPartner && locationSource !== "OSM") {
    return NextResponse.json(
      { ok: false, error: "Morada normalizada obrigatória. Usa a pesquisa para confirmar." },
      { status: 400 },
    );
  }
  if (!isPartner && !locationProviderId) {
    return NextResponse.json({ ok: false, error: "Seleciona uma morada normalizada antes de guardar." }, { status: 400 });
  }
  if (isPartner && sourceClubIdRaw && !Number.isFinite(sourceClubIdRaw)) {
    return NextResponse.json({ ok: false, error: "Clube parceiro inválido." }, { status: 400 });
  }

  const courtsCount = courtsCountRaw && Number.isFinite(courtsCountRaw)
    ? Math.min(1000, Math.max(1, Math.floor(courtsCountRaw)))
    : 1;
  const baseSlug = slugInput || normalizeSlug(resolvedName);

  const safeIsDefault = !isPartner && isActive ? isDefault : false;

  try {
    if (isPartner && !existing && Number.isFinite(sourceClubIdRaw)) {
      const source = await prisma.padelClub.findFirst({
        where: { id: Math.floor(sourceClubIdRaw as number), deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!source) {
        return NextResponse.json(
          { ok: false, error: "Clube parceiro indisponível ou inexistente." },
          { status: 400 },
        );
      }
    }

    const slug = baseSlug ? await generateUniqueSlug(baseSlug, organization.id, id) : null;
    const sourceClubId =
      isPartner && Number.isFinite(sourceClubIdRaw)
        ? Math.floor(sourceClubIdRaw as number)
        : isPartner
          ? existing?.sourceClubId ?? null
          : null;

    const data = isPartner && existing
      ? {
          isActive,
          isDefault: false,
        }
      : {
          organizationId: organization.id,
          name: resolvedName,
          shortName: resolvedName,
          city: resolvedCity || null,
          address: resolvedAddress || null,
          courtsCount,
          hours: null,
          favoriteCategoryIds: [],
          isActive,
          slug: slug || null,
          isDefault: safeIsDefault,
          kind,
          sourceClubId,
          locationSource,
          locationProviderId,
          locationFormattedAddress,
          locationComponents,
          latitude,
          longitude,
        };

    const club = await prisma.$transaction(async (tx) => {
      let saved = id
        ? await tx.padelClub.update({
            where: { id, organizationId: organization.id, deletedAt: null },
            data,
          })
        : await tx.padelClub.create({
            data,
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

    return NextResponse.json({ ok: true, club }, { status: id ? 200 : 201 });
  } catch (err) {
    console.error("[padel/clubs] error", err);
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Já existe um clube com este slug/nome. Escolhe outro." },
        { status: 409 },
      );
    }
    const msg =
      err instanceof Error && err.message.includes("Record to update not found")
        ? "Clube não encontrado."
        : "Erro ao gravar clube.";
    const status = msg === "Clube não encontrado." ? 404 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

// Soft delete club (marks isActive=false, deletedAt now)
export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const url = new URL(req.url);
  const idParam = url.searchParams.get("id");
  const clubId = idParam ? Number(idParam) : NaN;
  const orgId = resolveOrganizationIdFromParams(url.searchParams);

  if (!Number.isFinite(clubId)) return NextResponse.json({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: orgId ?? undefined,
    roles: writeRoles,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const club = await prisma.padelClub.findFirst({
    where: { id: clubId, organizationId: organization.id, deletedAt: null },
  });
  if (!club) return NextResponse.json({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });

  const tournamentRefs = await prisma.padelTournamentConfig.count({
    where: {
      organizationId: organization.id,
      OR: [{ padelClubId: clubId }, { partnerClubIds: { has: clubId } }],
    },
  });
  if (tournamentRefs > 0) {
    return NextResponse.json(
      { ok: false, error: "Não podes apagar um clube associado a torneios. Remove-o dessas provas primeiro." },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.padelClubCourt.deleteMany({ where: { padelClubId: clubId } });
    await tx.padelClubStaff.deleteMany({ where: { padelClubId: clubId } });
    await tx.padelClub.delete({ where: { id: clubId } });
  });

  return NextResponse.json({ ok: true, deleted: true }, { status: 200 });
}
