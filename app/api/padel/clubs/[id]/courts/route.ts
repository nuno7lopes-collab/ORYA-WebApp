export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { readNumericParam } from "@/lib/routeParams";

const readRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN", "STAFF"];
const writeRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

export async function GET(req: NextRequest) {
  const clubId = readNumericParam(undefined, req, "clubs");
  if (clubId === null) return NextResponse.json({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const { organization } = await getActiveOrganizationForUser(user.id, { roles: readRoles });
  if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const club = await prisma.padelClub.findFirst({ where: { id: clubId, organizationId: organization.id, deletedAt: null } });
  if (!club) return NextResponse.json({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });
  if (club.kind === "PARTNER") {
    return NextResponse.json({ ok: false, error: "CLUB_READ_ONLY" }, { status: 403 });
  }

  const courts = await prisma.padelClubCourt.findMany({
    where: { padelClubId: club.id },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ ok: true, items: courts }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const clubId = readNumericParam(undefined, req, "clubs");
  if (clubId === null) return NextResponse.json({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const { organization } = await getActiveOrganizationForUser(user.id, { roles: writeRoles });
  if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const club = await prisma.padelClub.findFirst({ where: { id: clubId, organizationId: organization.id, deletedAt: null } });
  if (!club) return NextResponse.json({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });
  if (club.kind === "PARTNER") {
    return NextResponse.json({ ok: false, error: "CLUB_READ_ONLY" }, { status: 403 });
  }

  const courtId = typeof body.id === "number" ? body.id : null;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const surface = typeof body.surface === "string" ? body.surface.trim() : "";
  const indoor = typeof body.indoor === "boolean" ? body.indoor : false;
  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;
  const displayOrderRaw =
    typeof body.displayOrder === "number"
      ? body.displayOrder
      : typeof body.displayOrder === "string"
        ? Number(body.displayOrder)
        : null;
  const displayOrder = Number.isFinite(displayOrderRaw)
    ? Math.min(10000, Math.max(0, Math.floor(displayOrderRaw as number)))
    : 0;

  try {
    let finalName = name;
    if (!finalName) {
      // Gera nome sequencial quando vazio (Court 1, Court 2, ...)
      const count = await prisma.padelClubCourt.count({ where: { padelClubId: club.id } });
      finalName = `Court ${count + 1}`;
    }

    const data = {
      padelClubId: club.id,
      name: finalName,
      description: description || null,
      surface: surface || null,
      indoor,
      isActive,
      displayOrder,
    };

    const court = courtId
      ? await prisma.padelClubCourt.update({
          where: { id: courtId, padelClubId: club.id },
          data,
        })
      : await prisma.padelClubCourt.create({ data });

    return NextResponse.json({ ok: true, court }, { status: courtId ? 200 : 201 });
  } catch (err) {
    console.error("[padel/clubs/courts] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// Hard delete court
export async function DELETE(req: NextRequest) {
  const clubId = readNumericParam(undefined, req, "clubs");
  if (clubId === null) return NextResponse.json({ ok: false, error: "INVALID_CLUB" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const { organization } = await getActiveOrganizationForUser(user.id, { roles: writeRoles });
  if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });

  const url = new URL(req.url);
  const courtIdParam = url.searchParams.get("courtId");
  const courtId = courtIdParam ? Number(courtIdParam) : NaN;
  if (!Number.isFinite(courtId)) return NextResponse.json({ ok: false, error: "INVALID_COURT" }, { status: 400 });

  const club = await prisma.padelClub.findFirst({ where: { id: clubId, organizationId: organization.id, deletedAt: null } });
  if (!club) return NextResponse.json({ ok: false, error: "CLUB_NOT_FOUND" }, { status: 404 });

  try {
    const deleted = await prisma.padelClubCourt.delete({ where: { id: courtId, padelClubId: club.id } });
    return NextResponse.json({ ok: true, court: deleted }, { status: 200 });
  } catch (err) {
    console.error("[padel/clubs/courts/delete] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
