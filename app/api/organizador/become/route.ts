

// app/api/organizador/become/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

type OrganizerPayload = {
  entityType?: string | null;
  businessName?: string | null;
  city?: string | null;
  payoutIban?: string | null;
};

function sanitizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 400 },
      );
    }

    const organizer = await prisma.organizer.findFirst({
      where: { userId: profile.id },
    });

    return NextResponse.json(
      {
        ok: true,
        organizer: organizer
          ? {
              id: organizer.id,
              displayName: organizer.displayName,
              status: organizer.status,
              stripeAccountId: organizer.stripeAccountId,
              entityType: organizer.entityType,
              businessName: organizer.businessName,
              city: organizer.city,
              payoutIban: organizer.payoutIban,
            }
          : null,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("GET /api/organizador/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao obter organizador." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado." },
        { status: 400 },
      );
    }

    // Corpo opcional com dados de onboarding
    let payload: OrganizerPayload = {};
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        payload = await req.json();
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const form = await req.formData();
        payload = {
          entityType: form.get("entityType") as string | null,
          businessName: form.get("businessName") as string | null,
          city: form.get("city") as string | null,
          payoutIban: form.get("payoutIban") as string | null,
        };
      }
    } catch {
      /* ignora parsing */
    }

    const entityType = sanitizeString(payload.entityType);
    const businessName = sanitizeString(payload.businessName);
    const city = sanitizeString(payload.city);
    const payoutIban = sanitizeString(payload.payoutIban);

    // Procurar organizer existente para este user
    let organizer = await prisma.organizer.findFirst({
      where: { userId: profile.id },
    });

    const displayName =
      businessName ||
      profile.fullName?.trim() ||
      profile.username ||
      "Organizador";

    if (!organizer) {
      organizer = await prisma.organizer.create({
        data: {
          userId: profile.id,
          displayName,
          status: "ACTIVE", // self-serve aberto
          entityType,
          businessName,
          city,
          payoutIban,
        },
      });
    } else {
      organizer = await prisma.organizer.update({
        where: { id: organizer.id },
        data: {
          status: "ACTIVE",
          displayName,
          entityType,
          businessName,
          city,
          payoutIban,
        },
      });
    }

    // Garante que o perfil tem role de organizer
    const roles = Array.isArray(profile.roles) ? profile.roles : [];
    if (!roles.includes("organizer")) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { roles: [...roles, "organizer"] },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        organizer: {
          id: organizer.id,
          displayName: organizer.displayName,
          status: organizer.status,
          stripeAccountId: organizer.stripeAccountId,
          entityType: organizer.entityType,
          businessName: organizer.businessName,
          city: organizer.city,
          payoutIban: organizer.payoutIban,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("POST /api/organizador/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao enviar candidatura de organizador." },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { ok: false, error: "Não autenticado." },
        { status: 401 },
      );
    }

    await prisma.organizer.deleteMany({
      where: { userId: user.id, status: "PENDING" },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/organizador/become error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao cancelar candidatura." },
      { status: 500 },
    );
  }
}
