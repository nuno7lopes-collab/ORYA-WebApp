import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { canManageEvents } from "@/lib/organizationPermissions";
import { createNotification, shouldNotify } from "@/lib/notifications";
import { NotificationType, TicketStatus } from "@prisma/client";
import { randomUUID } from "crypto";

const MAX_RECIPIENTS = 1500;

type BroadcastPayload = {
  eventId?: number;
  title?: string;
  body?: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const payload = (await req.json().catch(() => ({}))) as BroadcastPayload;

    const eventId = Number(payload.eventId);
    const title = typeof payload.title === "string" ? payload.title.trim() : "";
    const body = typeof payload.body === "string" ? payload.body.trim() : "";
    const ctaLabel = typeof payload.ctaLabel === "string" ? payload.ctaLabel.trim() : null;
    const ctaUrl = typeof payload.ctaUrl === "string" ? payload.ctaUrl.trim() : null;

    if (!Number.isFinite(eventId) || eventId <= 0) {
      return NextResponse.json({ ok: false, error: "Seleciona um evento valido." }, { status: 400 });
    }
    if (title.length < 3) {
      return NextResponse.json({ ok: false, error: "Define um titulo com pelo menos 3 caracteres." }, { status: 400 });
    }
    if (body.length < 5) {
      return NextResponse.json({ ok: false, error: "Define uma mensagem com pelo menos 5 caracteres." }, { status: 400 });
    }
    if ((ctaLabel && !ctaUrl) || (!ctaLabel && ctaUrl)) {
      return NextResponse.json({ ok: false, error: "Define o texto e o link do CTA." }, { status: 400 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });

    if (!organization || !membership || !canManageEvents(membership.role)) {
      return NextResponse.json({ ok: false, error: "Sem permissoes para enviar mensagens." }, { status: 403 });
    }

    const moduleEnabled = await prisma.organizationModuleEntry.findFirst({
      where: { organizationId: organization.id, moduleKey: "MENSAGENS", enabled: true },
      select: { moduleKey: true },
    });
    if (!moduleEnabled) {
      return NextResponse.json({ ok: false, error: "Modulo de mensagens desativado." }, { status: 403 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId: organization.id, isDeleted: false },
      select: { id: true, title: true },
    });
    if (!event) {
      return NextResponse.json({ ok: false, error: "Evento nao encontrado." }, { status: 404 });
    }

    const tickets = await prisma.ticket.findMany({
      where: { eventId: event.id, status: { in: [TicketStatus.ACTIVE, TicketStatus.USED] } },
      select: { userId: true, ownerUserId: true },
    });
    const userIds = Array.from(
      new Set(
        tickets
          .map((ticket) => ticket.ownerUserId || ticket.userId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    );

    if (userIds.length === 0) {
      return NextResponse.json({ ok: false, error: "Sem participantes para notificar." }, { status: 400 });
    }
    if (userIds.length > MAX_RECIPIENTS) {
      return NextResponse.json(
        { ok: false, error: "Demasiados participantes. Divide em envios menores." },
        { status: 400 },
      );
    }

    const broadcastId = randomUUID();
    const payloadBase = {
      source: "ORG_BROADCAST",
      broadcastId,
      target: { eventId: event.id },
    };

    let recipients = 0;
    for (const userId of userIds) {
      const allowed = await shouldNotify(userId, NotificationType.SYSTEM_ANNOUNCE);
      if (!allowed) continue;
      await createNotification({
        userId,
        type: NotificationType.SYSTEM_ANNOUNCE,
        title,
        body,
        ctaLabel: ctaLabel || null,
        ctaUrl: ctaUrl || null,
        organizationId: organization.id,
        eventId: event.id,
        payload: payloadBase,
        priority: "NORMAL",
      });
      recipients += 1;
    }

    return NextResponse.json({ ok: true, recipients, broadcastId });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Sessao invalida." }, { status: 401 });
    }
    console.error("[mensagens][broadcast] erro inesperado", err);
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
