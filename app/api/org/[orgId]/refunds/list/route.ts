import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import type { Prisma } from "@prisma/client";
import { OrganizationModule, RefundCasePolicyCause, RefundReason } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const PAGE_SIZE = 50;

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

    if (error || !user) {
      return respondError(
        ctx,
        { errorCode: "UNAUTHENTICATED", message: "Sessão inválida.", retryable: false },
        { status: 401 },
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return respondError(
        ctx,
        { errorCode: "FORBIDDEN", message: "Sem permissões.", retryable: false },
        { status: 403 },
      );
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.FINANCEIRO,
      required: "VIEW",
    });
    if (!access.ok) {
      return respondError(
        ctx,
        { errorCode: "FORBIDDEN", message: "Sem permissões.", retryable: false },
        { status: 403 },
      );
    }

    const url = new URL(req.url);
    const cursorRaw = url.searchParams.get("cursor");
    const cursor = typeof cursorRaw === "string" && cursorRaw.trim() ? cursorRaw.trim() : null;
    const q = url.searchParams.get("q")?.trim() ?? "";
    const reasonParam = url.searchParams.get("reason")?.trim().toUpperCase() ?? "";
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const fromDate = fromParam ? new Date(fromParam) : null;
    const toDate = toParam ? new Date(toParam) : null;

    const where: Prisma.RefundCaseWhereInput = {
      organizationId: organization.id,
    };
    const reason = (["CANCELLED", "DELETED", "DATE_CHANGED"] as string[]).includes(reasonParam)
      ? (reasonParam as RefundReason)
      : null;
    if (reason) {
      if (reason === "DELETED") {
        where.policyCause = RefundCasePolicyCause.EVENT_DELETED;
      } else if (reason === "DATE_CHANGED") {
        where.policyCause = RefundCasePolicyCause.EVENT_DATE_CHANGED;
      } else {
        where.policyCause = {
          in: [
            RefundCasePolicyCause.EVENT_CANCELLED,
            RefundCasePolicyCause.PADEL_EVENT_CANCEL,
            RefundCasePolicyCause.PADEL_SYSTEM_CANCEL,
            RefundCasePolicyCause.BOOKING_ORG_CANCEL,
            RefundCasePolicyCause.STORE_ORG_CANCEL,
            RefundCasePolicyCause.ADMIN_MANUAL,
          ],
        };
      }
    }
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (fromDate && !Number.isNaN(fromDate.getTime())) {
      createdAtFilter.gte = fromDate;
    }
    if (toDate && !Number.isNaN(toDate.getTime())) {
      createdAtFilter.lte = toDate;
    }
    if (Object.keys(createdAtFilter).length) {
      where.createdAt = createdAtFilter;
    }
    if (q) {
      where.OR = [
        { paymentId: { contains: q, mode: "insensitive" } },
        { paymentIntentId: { contains: q, mode: "insensitive" } },
        { sourceId: { contains: q, mode: "insensitive" } },
        { idempotencyKey: { contains: q, mode: "insensitive" } },
      ];
    }

    const items = await prisma.refundCase.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > PAGE_SIZE;
    const trimmed = hasMore ? items.slice(0, PAGE_SIZE) : items;
    const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id ?? null : null;

    const paymentIds = Array.from(new Set(trimmed.map((item) => item.paymentId).filter(Boolean)));
    const saleSummaries = paymentIds.length
      ? await prisma.saleSummary.findMany({
          where: { purchaseId: { in: paymentIds } },
          select: { purchaseId: true, currency: true, eventId: true, event: { select: { title: true } } },
        })
      : [];
    const saleSummaryByPayment = new Map(
      saleSummaries.map((summary) => [summary.purchaseId ?? "", summary]),
    );

    const mapped = trimmed.map((refundCase) => {
      const saleSummary = saleSummaryByPayment.get(refundCase.paymentId);
      const amounts =
        refundCase.amountsBreakdown &&
        typeof refundCase.amountsBreakdown === "object" &&
        !Array.isArray(refundCase.amountsBreakdown)
          ? (refundCase.amountsBreakdown as Record<string, unknown>)
          : null;
      return {
        id: refundCase.id,
        refundCaseId: refundCase.id,
        eventId: saleSummary?.eventId ?? null,
        eventTitle: saleSummary?.event?.title ?? null,
        sourceType: refundCase.sourceType,
        sourceId: refundCase.sourceId,
        purchaseId: refundCase.paymentId,
        paymentIntentId: refundCase.paymentIntentId,
        baseAmountCents: amounts && typeof amounts.refundCents === "number" ? Number(amounts.refundCents) : null,
        feesExcludedCents:
          amounts &&
          typeof amounts.retainedPlatformFeeCents === "number" &&
          typeof amounts.retainedCardPlatformFeeCents === "number" &&
          typeof amounts.retainedProcessorFeeCents === "number"
            ? Number(amounts.retainedPlatformFeeCents) +
              Number(amounts.retainedCardPlatformFeeCents) +
              Number(amounts.retainedProcessorFeeCents)
            : null,
        currency:
          (amounts && typeof amounts.currency === "string" ? amounts.currency : null) ??
          saleSummary?.currency ??
          "EUR",
        reason: refundCase.reasonCode,
        refundStatus: refundCase.status,
        refundedAt: refundCase.updatedAt,
        createdAt: refundCase.createdAt,
      };
    });

    return respondOk(ctx, { items: mapped, pagination: { nextCursor, hasMore } }, { status: 200 });
  } catch (err) {
    console.error("[organizacao/refunds/list]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}
export const GET = withApiEnvelope(_GET);
