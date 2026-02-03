import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { TicketStatus, ResaleStatus, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError, logWarn } from "@/lib/observability/logger";

const resaleSelect = {
  id: true,
  sellerUserId: true,
  status: true,
  ticketId: true,
  ticket: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.TicketResaleSelect;

/**
 * F5-8 – Cancelar revenda
 * Body esperado: { resaleId: string }
 */
async function _POST(req: NextRequest) {
  try {
    // 1. Auth – garantir utilizador autenticado
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      logWarn("tickets.resale_cancel_auth_failed", { error: authError });
    }

    if (!user) {
      return jsonWrap(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { roles: true },
    });
    const roles = Array.isArray(profile?.roles) ? (profile?.roles as string[]) : [];
    const isAdmin = roles.some((r) => r?.toLowerCase() === "admin");
    if (!isAdmin) {
      return jsonWrap(
        { ok: false, error: "FORBIDDEN" },
        { status: 403 },
      );
    }

    const body = (await req.json().catch(() => null)) as
      | { resaleId?: string }
      | null;

    if (!body || typeof body !== "object" || !body.resaleId) {
      return jsonWrap(
        { ok: false, error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { resaleId } = body;
    const userId = user.id;

    // 2. Buscar revenda e garantir que pertence ao utilizador e está LISTED
    const resale = await prisma.ticketResale.findUnique({
      where: { id: resaleId },
      select: resaleSelect,
    });

    if (!resale) {
      return jsonWrap(
        { ok: false, error: "RESALE_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (resale.sellerUserId !== userId) {
      return jsonWrap(
        { ok: false, error: "NOT_RESALE_OWNER" },
        { status: 403 }
      );
    }

    if (resale.status !== ResaleStatus.LISTED) {
      return jsonWrap(
        { ok: false, error: "RESALE_NOT_LISTED" },
        { status: 400 }
      );
    }

    if (!resale.ticket) {
      return jsonWrap(
        { ok: false, error: "TICKET_NOT_FOUND_FOR_RESALE" },
        { status: 404 }
      );
    }

    // 3. Transaction – marcar revenda como CANCELLED
    //    e (opcional) voltar o ticket a ACTIVE
    await prisma.$transaction(async (tx) => {
      await tx.ticketResale.update({
        where: { id: resale.id },
        data: {
          status: ResaleStatus.CANCELLED,
          completedAt: new Date(),
        },
      });

      // Se o bilhete estiver com algum estado específico de revenda,
      // garantimos que volta a ACTIVE. Mesmo que já estivesse ACTIVE,
      // isto não é problemático.
      await tx.ticket.update({
        where: { id: resale.ticketId },
        data: {
          status: TicketStatus.ACTIVE,
        },
      });
    });

    return jsonWrap({ ok: true }, { status: 200 });
  } catch (error) {
    logError("tickets.resale_cancel_failed", error);
    return jsonWrap(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
export const POST = withApiEnvelope(_POST);
