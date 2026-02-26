import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule, RefundCaseStatus, SourceType, type Prisma } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

const PAGE_SIZE = 50;

function parseStatus(raw: string | null): RefundCaseStatus | null {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  return (Object.values(RefundCaseStatus) as string[]).includes(normalized)
    ? (normalized as RefundCaseStatus)
    : null;
}

function parseSourceType(raw: string | null): SourceType | null {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  return (Object.values(SourceType) as string[]).includes(normalized)
    ? (normalized as SourceType)
    : null;
}

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
    const statusFilter = parseStatus(url.searchParams.get("status"));
    const sourceTypeFilter = parseSourceType(url.searchParams.get("sourceType"));
    const cursorRaw = url.searchParams.get("cursor");
    const cursor = typeof cursorRaw === "string" && cursorRaw.trim().length > 0 ? cursorRaw.trim() : null;
    const q = url.searchParams.get("q")?.trim() ?? "";

    const where: Prisma.RefundCaseWhereInput = {
      organizationId: organization.id,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(sourceTypeFilter ? { sourceType: sourceTypeFilter } : {}),
      ...(q
        ? {
            OR: [
              { paymentId: { contains: q, mode: "insensitive" } },
              { paymentIntentId: { contains: q, mode: "insensitive" } },
              { sourceId: { contains: q, mode: "insensitive" } },
              { idempotencyKey: { contains: q, mode: "insensitive" } },
              { reasonCode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const rows = await prisma.refundCase.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        paymentId: true,
        paymentIntentId: true,
        policyCause: true,
        culpability: true,
        requestedBy: true,
        reasonCode: true,
        amountsBreakdown: true,
        status: true,
        attempts: true,
        nextRetryAt: true,
        lastError: true,
        stripeRefundId: true,
        idempotencyKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasMore = rows.length > PAGE_SIZE;
    const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return respondOk(
      ctx,
      {
        items,
        pagination: {
          nextCursor,
          hasMore,
        },
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizacao/refunds/cases]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro interno.", retryable: true },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
