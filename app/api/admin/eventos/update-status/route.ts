// app/api/admin/eventos/update-status/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import type { EventStatus } from "@prisma/client";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { refundKey } from "@/lib/stripe/idempotency";

/**
 * 6.14 – Update de estado de evento (admin)
 *
 * Body esperado (POST JSON):
 * {
 *   "eventId"?: number | string,
 *   "slug"?: string,
 *   "status": string  // ex: "PUBLISHED", "CANCELLED", "BLOCKED"...
 * }
 *
 * Regras:
 *  - Só utilizadores com role "admin" podem chamar.
 *  - É possível identificar evento por eventId OU por slug.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[admin/eventos/update-status] authError:", authError);
    }

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    // Confirmar se é admin
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { roles: true },
    });

    const roles = profile?.roles ?? [];
    const isAdmin = Array.isArray(roles) && roles.includes("admin");

    if (!isAdmin) {
      return NextResponse.json(
        { ok: false, error: "FORBIDDEN_NOT_ADMIN" },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as
      | {
          eventId?: number | string;
          slug?: string;
          status?: string;
        }
      | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "INVALID_BODY" },
        { status: 400 }
      );
    }

    const { eventId, slug, status } = body;

    if (!status || typeof status !== "string") {
      return NextResponse.json(
        { ok: false, error: "MISSING_STATUS" },
        { status: 400 }
      );
    }

    // Construir o "where" dinamicamente: por id OU por slug
    let whereClause:
      | {
          id: number;
        }
      | {
          slug: string;
        }
      | null = null;

    if (typeof eventId === "number") {
      whereClause = { id: eventId };
    } else if (typeof eventId === "string") {
      const parsed = Number(eventId);
      if (!Number.isNaN(parsed)) {
        whereClause = { id: parsed };
      }
    } else if (typeof slug === "string" && slug.trim() !== "") {
      whereClause = { slug: slug.trim() };
    }

    if (!whereClause) {
      return NextResponse.json(
        { ok: false, error: "MISSING_EVENT_IDENTIFIER" },
        { status: 400 }
      );
    }

    // Atualizar evento
    try {
      const updated = await prisma.event.update({
        where: whereClause,
        data: {
          // Cast para EventStatus para corresponder ao enum do Prisma
          status: status as EventStatus,
        },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          type: true,
          organizerId: true,
          startsAt: true,
          updatedAt: true,
        },
      });

      const now = new Date();
      const shouldAutoRefund =
        updated.status === "CANCELLED" && updated.startsAt && updated.startsAt.getTime() > now.getTime();

      if (shouldAutoRefund) {
        // Disparar refunds base-only para todas as compras deste evento (idempotente por dedupeKey)
        const summaries = await prisma.saleSummary.findMany({
          where: { eventId: updated.id, status: "PAID" },
          select: { purchaseId: true, paymentIntentId: true },
        });
        await Promise.all(
          summaries.map((s) =>
            enqueueOperation({
              operationType: "PROCESS_REFUND_SINGLE",
              dedupeKey: refundKey(s.purchaseId ?? s.paymentIntentId ?? "unknown"),
              correlations: { eventId: updated.id, purchaseId: s.purchaseId ?? s.paymentIntentId ?? null, paymentIntentId: s.paymentIntentId ?? null },
              payload: {
                eventId: updated.id,
                purchaseId: s.purchaseId ?? s.paymentIntentId ?? null,
                paymentIntentId: s.paymentIntentId ?? null,
                reason: "CANCELLED",
                refundedBy: user.id,
              },
            }),
          ),
        );
      }

      return NextResponse.json(
        {
          ok: true,
          event: updated,
        },
        { status: 200 }
      );
    } catch (err) {
      // P2025 = record not found
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "P2025"
      ) {
        return NextResponse.json(
          { ok: false, error: "EVENT_NOT_FOUND" },
          { status: 404 }
        );
      }

      console.error(
        "[admin/eventos/update-status] Error updating event status:",
        err
      );
      return NextResponse.json(
        { ok: false, error: "INTERNAL_ERROR" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("[admin/eventos/update-status] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
