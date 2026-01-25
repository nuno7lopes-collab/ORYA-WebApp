import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { refundPurchase } from "@/lib/refunds/refundService";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { OrganizationModule, RefundReason } from "@prisma/client";
import { mapV7StatusToLegacy } from "@/lib/entitlements/status";

const ALLOWED_REASONS: RefundReason[] = ["CANCELLED", "DELETED", "DATE_CHANGED"];

function parseReason(value: unknown): RefundReason {
  if (typeof value !== "string") return "CANCELLED";
  const normalized = value.trim().toUpperCase();
  return (ALLOWED_REASONS as string[]).includes(normalized) ? (normalized as RefundReason) : "CANCELLED";
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const eventId = Number(resolved.id);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ ok: false, error: "EVENT_INVALID" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true, title: true },
    });
    if (!event?.organizationId) {
      return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: event.organizationId,
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.FINANCEIRO,
      required: "EDIT",
    });
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const purchaseId = typeof payload?.purchaseId === "string" ? payload.purchaseId.trim() : "";
    if (!purchaseId) {
      return NextResponse.json({ ok: false, error: "PURCHASE_ID_REQUIRED" }, { status: 400 });
    }

    const saleSummary = await prisma.saleSummary.findUnique({
      where: { purchaseId },
      select: { paymentIntentId: true, eventId: true },
    });
    if (!saleSummary || saleSummary.eventId !== eventId) {
      return NextResponse.json({ ok: false, error: "PURCHASE_NOT_FOUND" }, { status: 404 });
    }

    const reason = parseReason(payload?.reason);
    const { ip, userAgent } = getRequestMeta(req);

    const refund = await refundPurchase({
      purchaseId,
      paymentIntentId: saleSummary.paymentIntentId,
      eventId,
      reason,
      refundedBy: user.id,
      auditPayload: {
        source: "ORG_PANEL",
        eventTitle: event.title,
        actorRole: membership.role,
      },
    });

    if (!refund) {
      return NextResponse.json({ ok: false, error: "REFUND_FAILED" }, { status: 502 });
    }

    await prisma.entitlement.updateMany({
      where: { purchaseId },
      data: { status: mapV7StatusToLegacy("REVOKED") },
    });

    await recordOrganizationAudit(prisma, {
      organizationId: event.organizationId,
      actorUserId: user.id,
      action: "EVENT_REFUND_CREATED",
      metadata: {
        eventId,
        purchaseId,
        reason,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({
      ok: true,
      refundId: refund.id,
      refundedAt: refund.refundedAt,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/events/[id]/refund error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao reembolsar compra." }, { status: 500 });
  }
}
