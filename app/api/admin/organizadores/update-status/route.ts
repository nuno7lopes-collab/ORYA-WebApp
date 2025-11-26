// app/api/admin/organizadores/update-status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

// Tipos de estados permitidos para organizadores (ajusta se o enum tiver outros valores)
const ALLOWED_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;

type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

type UpdateOrganizerStatusBody = {
  organizerId?: number | string;
  newStatus?: string;
};

async function getAdminUserId(): Promise<string | null> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const profile = await prisma.profile.findUnique({ where: { id: user.id } });

  if (!profile) return null;

  const roles = (profile.roles as string[] | null) ?? [];
  const isAdmin = roles.includes("admin");

  if (!isAdmin) return null;

  return user.id;
}

export async function POST(req: NextRequest) {
  try {
    const adminUserId = await getAdminUserId();

    if (!adminUserId) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => null)) as
      | UpdateOrganizerStatusBody
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY" },
        { status: 400 },
      );
    }

    const { organizerId, newStatus } = body;

    if (
      organizerId === undefined ||
      organizerId === null ||
      newStatus === undefined ||
      typeof newStatus !== "string"
    ) {
      return NextResponse.json(
        { ok: false, error: "MISSING_FIELDS" },
        { status: 400 },
      );
    }

    const normalizedStatus = newStatus.trim().toUpperCase() as AllowedStatus;

    if (!ALLOWED_STATUSES.includes(normalizedStatus)) {
      return NextResponse.json(
        { ok: false, error: "INVALID_STATUS" },
        { status: 400 },
      );
    }

    const organizerIdNumber =
      typeof organizerId === "string" ? Number(organizerId) : organizerId;

    if (
      typeof organizerIdNumber !== "number" ||
      Number.isNaN(organizerIdNumber) ||
      organizerIdNumber <= 0
    ) {
      return NextResponse.json(
        { ok: false, error: "INVALID_ORGANIZER_ID" },
        { status: 400 },
      );
    }

    const organizer = await prisma.organizer.findUnique({
      where: { id: organizerIdNumber },
      select: {
        id: true,
        status: true,
        displayName: true,
      },
    });

    if (!organizer) {
      return NextResponse.json(
        { ok: false, error: "ORGANIZER_NOT_FOUND" },
        { status: 404 },
      );
    }

    // Se o estado já está igual, devolvemos ok mas sem fazer update
    if (organizer.status === normalizedStatus) {
      return NextResponse.json(
        {
          ok: true,
          organizer: {
            id: organizer.id,
            status: organizer.status,
            displayName: organizer.displayName,
            changed: false,
          },
        },
        { status: 200 },
      );
    }

    const updated = await prisma.organizer.update({
      where: { id: organizerIdNumber },
      data: {
        status: normalizedStatus,
      },
      select: {
        id: true,
        status: true,
        displayName: true,
        userId: true,
      },
    });

    // Se aprovado (ACTIVE), adicionar role organizer ao profile
    if (normalizedStatus === "ACTIVE") {
      const profile = await prisma.profile.findUnique({
        where: { id: updated.userId },
        select: { roles: true },
      });
      const roles = Array.isArray(profile?.roles) ? profile?.roles : [];
      if (!roles.includes("organizer")) {
        await prisma.profile.update({
          where: { id: updated.userId },
          data: { roles: [...roles, "organizer"] },
        });
      }
    }

    return NextResponse.json(
      {
        ok: true,
        organizer: {
          id: updated.id,
          status: updated.status,
          displayName: updated.displayName,
          userId: updated.userId,
          changed: true,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[ADMIN][ORGANIZADORES][UPDATE-STATUS]", error);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}
