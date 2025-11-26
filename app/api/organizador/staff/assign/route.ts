

// app/api/organizador/staff/assign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, assertOrganizer } from "@/lib/security";

type AssignStaffBody = {
  userId?: string;
  emailOrUsername?: string;
  scope?: "GLOBAL" | "EVENT";
  eventId?: number;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    // Ler e validar body
    let body: AssignStaffBody | null = null;
    try {
      body = (await req.json()) as AssignStaffBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Body inválido." },
        { status: 400 }
      );
    }

    const { userId, emailOrUsername, scope, eventId } = body || {};

    if (!scope || (scope !== "GLOBAL" && scope !== "EVENT")) {
      return NextResponse.json(
        { ok: false, error: "scope inválido. Use 'GLOBAL' ou 'EVENT'." },
        { status: 400 }
      );
    }

    if (scope === "EVENT" && !eventId) {
      return NextResponse.json(
        {
          ok: false,
          error: "eventId é obrigatório quando o scope é 'EVENT'.",
        },
        { status: 400 }
      );
    }

    // Buscar profile do utilizador autenticado
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Perfil não encontrado. Completa o onboarding antes de gerir staff.",
        },
        { status: 400 }
      );
    }
    assertOrganizer(user, profile);

    // Garantir que é um organizador ativo
    const organizer = await prisma.organizer.findFirst({
      where: {
        userId: profile.id,
        status: "ACTIVE",
      },
    });

    if (!organizer) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ainda não és organizador ativo. Vai à área de organizador para começares.",
        },
        { status: 403 }
      );
    }

    // Resolver user alvo (permite userId direto OU email/username)
    let targetProfile = null;
    if (userId) {
      targetProfile = await prisma.profile.findUnique({
        where: { id: userId },
      });
    } else if (emailOrUsername) {
      const normalized = emailOrUsername.trim().replace(/^@/, "");
      targetProfile = await prisma.profile.findFirst({
        where: {
          OR: [{ username: normalized }, { fullName: normalized }],
        },
      });
    }

    if (!targetProfile) {
      return NextResponse.json(
        {
          ok: false,
          error: "Utilizador alvo (staff) não encontrado.",
        },
        { status: 404 }
      );
    }

    // Se vier userId vazio mas email/username preenchido, usar o encontrado
    const targetUserId = targetProfile.id;

    // Validar evento se scope EVENT (e garantir que pertence ao organizer)
    let targetEventId: number | null = null;
    if (scope === "EVENT") {
      targetEventId = Number(eventId);
      if (!Number.isFinite(targetEventId)) {
        return NextResponse.json(
          { ok: false, error: "eventId inválido." },
          { status: 400 },
        );
      }

      const event = await prisma.event.findFirst({
        where: {
          id: targetEventId,
          organizerId: organizer.id,
          status: "PUBLISHED",
          endsAt: { gte: new Date() },
        },
        select: { id: true },
      });

      if (!event) {
        return NextResponse.json(
          { ok: false, error: "Evento não encontrado ou inativo para este organizador." },
          { status: 404 },
        );
      }
    }

    // Procurar assignment existente (para não duplicar)
    const existing = await prisma.staffAssignment.findFirst({
      where: {
        organizerId: organizer.id,
        userId: targetUserId,
        scope,
        ...(scope === "EVENT" ? { eventId: targetEventId ?? undefined } : {}),
      },
    });

    let assignment;

    if (existing) {
      assignment = await prisma.staffAssignment.update({
        where: { id: existing.id },
        data: {
          revokedAt: null,
          acceptedAt: null,
          status: "PENDING",
          scope,
          eventId: scope === "EVENT" ? targetEventId ?? null : null,
          userId: targetUserId,
        },
      });
    } else {
      assignment = await prisma.staffAssignment.create({
        data: {
          organizerId: organizer.id,
          userId: targetUserId,
          scope,
          eventId: scope === "EVENT" ? targetEventId ?? null : null,
          status: "PENDING",
        },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        assignment,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/organizador/staff/assign error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno ao atribuir staff.",
      },
      { status: 500 }
    );
  }
}
