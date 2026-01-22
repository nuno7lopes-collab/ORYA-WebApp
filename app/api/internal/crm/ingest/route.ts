import { NextRequest, NextResponse } from "next/server";
import { CrmInteractionSource, CrmInteractionType } from "@prisma/client";
import { ingestCrmInteraction } from "@/lib/crm/ingest";

const INTERNAL_HEADER = "X-ORYA-CRON-SECRET";

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get(INTERNAL_HEADER);
    if (!secret || secret !== process.env.ORYA_CRON_SECRET) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const payload = (await req.json().catch(() => null)) as {
      organizationId?: unknown;
      userId?: unknown;
      type?: unknown;
      sourceType?: unknown;
      sourceId?: unknown;
      occurredAt?: unknown;
      amountCents?: unknown;
      currency?: unknown;
      metadata?: unknown;
      displayName?: unknown;
      contactEmail?: unknown;
      contactPhone?: unknown;
    } | null;

    const organizationId = typeof payload?.organizationId === "number" ? payload.organizationId : null;
    const userId = typeof payload?.userId === "string" ? payload.userId : null;
    const type =
      typeof payload?.type === "string" && Object.values(CrmInteractionType).includes(payload.type as CrmInteractionType)
        ? (payload.type as CrmInteractionType)
        : null;
    const sourceType =
      typeof payload?.sourceType === "string" && Object.values(CrmInteractionSource).includes(payload.sourceType as CrmInteractionSource)
        ? (payload.sourceType as CrmInteractionSource)
        : null;
    const sourceId = typeof payload?.sourceId === "string" ? payload.sourceId : null;
    const occurredAt = parseDate(payload?.occurredAt) ?? new Date();
    const amountCents = typeof payload?.amountCents === "number" ? payload.amountCents : null;
    const currency = typeof payload?.currency === "string" ? payload.currency.toUpperCase() : "EUR";
    const metadata = payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

    if (!organizationId || !userId || !type || !sourceType) {
      return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
    }

    const result = await ingestCrmInteraction({
      organizationId,
      userId,
      type,
      sourceType,
      sourceId,
      occurredAt,
      amountCents,
      currency,
      metadata,
      displayName: typeof payload?.displayName === "string" ? payload.displayName.trim() : null,
      contactEmail: typeof payload?.contactEmail === "string" ? payload.contactEmail.trim() : null,
      contactPhone: typeof payload?.contactPhone === "string" ? payload.contactPhone.trim() : null,
    });

    return NextResponse.json({ ok: true, deduped: result.deduped, customerId: result.customerId });
  } catch (err) {
    console.error("POST /api/internal/crm/ingest error:", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
