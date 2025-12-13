export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizerMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { PORTUGAL_CITIES } from "@/config/cities";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

function normalizeSlug(raw: string | null | undefined) {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function generateUniqueSlug(base: string, organizerId: number, excludeId?: number | null) {
  if (!base) return "";
  let candidate = base;
  let suffix = 2;
  // Garante slug único por organizador; acrescenta -2, -3, ...
  // Usa findFirst case-insensitive para evitar conflitos.
  while (true) {
    const exists = await prisma.padelClub.findFirst({
      where: {
        organizerId,
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

  const organizerIdParam = req.nextUrl.searchParams.get("organizerId");
  const parsedOrgId = organizerIdParam ? Number(organizerIdParam) : null;
  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: allowedRoles,
  });
  if (!organizer) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

  const items = await prisma.padelClub.findMany({
    where: { organizerId: organizer.id, deletedAt: null },
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

  const organizerIdParam = body.organizerId ?? req.nextUrl.searchParams.get("organizerId");
  const parsedOrgId =
    typeof organizerIdParam === "number" ? organizerIdParam : organizerIdParam ? Number(organizerIdParam) : null;
  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: allowedRoles,
  });
  if (!organizer) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

  const id = typeof body.id === "number" ? body.id : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const courtsCountRaw =
    typeof body.courtsCount === "number"
      ? body.courtsCount
      : typeof body.courtsCount === "string"
        ? Number(body.courtsCount)
        : null;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
  const slugInput = typeof body.slug === "string" ? normalizeSlug(body.slug) : "";
  const isDefault = typeof body.isDefault === "boolean" ? body.isDefault : false;

  if (!name || name.length < 3) {
    return NextResponse.json({ ok: false, error: "Nome do clube é obrigatório." }, { status: 400 });
  }

  if (city && !PORTUGAL_CITIES.includes(city as (typeof PORTUGAL_CITIES)[number])) {
    return NextResponse.json(
      { ok: false, error: "Cidade inválida. Escolhe uma cidade da lista disponível na ORYA." },
      { status: 400 },
    );
  }

  const courtsCount = courtsCountRaw && Number.isFinite(courtsCountRaw)
    ? Math.min(1000, Math.max(1, Math.floor(courtsCountRaw)))
    : 1;
  const baseSlug = slugInput || normalizeSlug(name);

  try {
    const slug = baseSlug ? await generateUniqueSlug(baseSlug, organizer.id, id) : null;

    const data = {
      organizerId: organizer.id,
      name,
      shortName: name,
      city: city || null,
      address: address || null,
      courtsCount,
      hours: null,
      favoriteCategoryIds: [],
      isActive,
      slug: slug || null,
      isDefault,
    };

    const club = await prisma.$transaction(async (tx) => {
      let saved = id
        ? await tx.padelClub.update({
            where: { id, organizerId: organizer.id, deletedAt: null },
            data,
          })
        : await tx.padelClub.create({
            data,
          });

      if (isDefault) {
        await tx.padelClub.updateMany({
          where: { organizerId: organizer.id, NOT: { id: saved.id }, isDefault: true },
          data: { isDefault: false },
        });
      } else {
        // Se não existir nenhum default, garante que o primeiro ativo fica default
        const defaults = await tx.padelClub.count({ where: { organizerId: organizer.id, isDefault: true } });
        if (defaults === 0 && saved.isActive) {
          saved = await tx.padelClub.update({ where: { id: saved.id }, data: { isDefault: true } });
        }
      }
      return saved;
    });

    return NextResponse.json({ ok: true, club }, { status: id ? 200 : 201 });
  } catch (err) {
    console.error("[padel/clubs] error", err);
    const msg = err instanceof Error && err.message.includes("Record to update not found") ? "Clube não encontrado." : "Erro ao gravar clube.";
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
  const organizerIdParam = url.searchParams.get("organizerId");
  const clubId = idParam ? Number(idParam) : NaN;
  const orgId = organizerIdParam ? Number(organizerIdParam) : NaN;

  if (!Number.isFinite(clubId)) return NextResponse.json({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: Number.isFinite(orgId) ? orgId : undefined,
    roles: allowedRoles,
  });
  if (!organizer) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

  const club = await prisma.padelClub.findFirst({
    where: { id: clubId, organizerId: organizer.id, deletedAt: null },
  });
  if (!club) return NextResponse.json({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.padelClub.update({
      where: { id: clubId },
      data: { isActive: false, deletedAt: new Date() },
    });
    await tx.padelClubStaff.updateMany({
      where: { padelClubId: clubId },
      data: { isActive: false, deletedAt: new Date() },
    });
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
