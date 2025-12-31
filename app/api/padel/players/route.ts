export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizerMemberRole, PadelPreferredSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";

const allowedRoles: OrganizerMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

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

  const players = await prisma.padelPlayerProfile.findMany({
    where: { organizerId: organizer.id },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({ ok: true, items: players }, { status: 200 });
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
  const parsedOrgId = typeof organizerIdParam === "number" ? organizerIdParam : organizerIdParam ? Number(organizerIdParam) : null;
  const { organizer } = await getActiveOrganizerForUser(user.id, {
    organizerId: Number.isFinite(parsedOrgId) ? parsedOrgId : undefined,
    roles: allowedRoles,
  });
  if (!organizer) return NextResponse.json({ ok: false, error: "NO_ORGANIZER" }, { status: 403 });

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : fullName;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() : null;
  const gender = typeof body.gender === "string" ? body.gender.trim() : null;
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

  if (!fullName) return NextResponse.json({ ok: false, error: "FULLNAME_REQUIRED" }, { status: 400 });

  try {
    const player = email
      ? await (async () => {
          const existing = await prisma.padelPlayerProfile.findFirst({
            where: { organizerId: organizer.id, email },
            select: { id: true },
          });
          if (existing?.id) {
            return prisma.padelPlayerProfile.update({
              where: { id: existing.id },
              data: {
                fullName,
                displayName: displayName || fullName,
                phone,
                gender,
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
              organizerId: organizer.id,
              fullName,
              displayName: displayName || fullName,
              email,
              phone,
              gender,
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
            organizerId: organizer.id,
            fullName,
            displayName: displayName || fullName,
            phone,
            gender,
            level,
            isActive,
            notes: notes || undefined,
            preferredSide: preferredSide || undefined,
            clubName: clubName || undefined,
            birthDate: birthDate && !Number.isNaN(birthDate.getTime()) ? birthDate : undefined,
          },
        });

    return NextResponse.json({ ok: true, player }, { status: 201 });
  } catch (err) {
    console.error("[padel/players][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
