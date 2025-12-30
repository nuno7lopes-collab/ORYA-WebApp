

// app/api/organizador/staff/assign/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { StaffRole } from "@prisma/client";
import { isOrgAdminOrAbove } from "@/lib/organizerPermissions";

type AssignStaffBody = {
  userId?: string;
  emailOrUsername?: string;
  scope?: "GLOBAL" | "EVENT";
  eventId?: number;
  organizerId?: number;
  role?: StaffRole;
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

    const { userId, emailOrUsername, scope, eventId, role, organizerId: organizerIdRaw } = body || {};

    if (!scope || (scope !== "GLOBAL" && scope !== "EVENT")) {
      return NextResponse.json(
        { ok: false, error: "scope inválido. Use 'GLOBAL' ou 'EVENT'." },
        { status: 400 }
      );
    }

    const allowedRoles: StaffRole[] = ["OWNER", "ADMIN", "STAFF", "CHECKIN"];
    const chosenRole: StaffRole = allowedRoles.includes(role as StaffRole) ? (role as StaffRole) : "STAFF";

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

    // Resolver organizerId: vir no payload ou através do evento
    let organizerId = Number(organizerIdRaw);
    if (scope === "EVENT" && eventId) {
      const event = await prisma.event.findUnique({
        where: { id: Number(eventId) },
        select: { id: true, organizerId: true, status: true, endsAt: true },
      });
      if (!event) {
        return NextResponse.json({ ok: false, error: "Evento não encontrado." }, { status: 404 });
      }
      organizerId = event.organizerId;
      if (event.status !== "PUBLISHED" || (event.endsAt && event.endsAt < new Date())) {
        return NextResponse.json({ ok: false, error: "Evento inativo para atribuir staff." }, { status: 400 });
      }
    }

    if (!Number.isFinite(organizerId)) {
      return NextResponse.json(
        { ok: false, error: "organizerId é obrigatório." },
        { status: 400 }
      );
    }

    // Validar membership do caller
    const callerMembership = await prisma.organizerMember.findUnique({
      where: { organizerId_userId: { organizerId, userId: user.id } },
    });
    if (!callerMembership || !isOrgAdminOrAbove(callerMembership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const organizer = await prisma.organizer.findUnique({
      where: { id: organizerId },
      select: { id: true, status: true },
    });
    if (!organizer || organizer.status !== "ACTIVE") {
      return NextResponse.json(
        { ok: false, error: "Organização inativa ou inexistente." },
        { status: 404 }
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

      if (targetEventId) {
        const event = await prisma.event.findFirst({
          where: {
            id: targetEventId,
            organizerId,
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
    }

    // Procurar assignment existente (para não duplicar)
    const existing = await prisma.staffAssignment.findFirst({
      where: {
        organizerId,
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
          role: chosenRole,
        },
      });
    } else {
      assignment = await prisma.staffAssignment.create({
        data: {
          organizerId,
          userId: targetUserId,
          scope,
          eventId: scope === "EVENT" ? targetEventId ?? null : null,
          status: "PENDING",
          role: chosenRole,
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
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
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
