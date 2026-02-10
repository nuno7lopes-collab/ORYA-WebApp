export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { generateQR, signTicketToORYA2 } from "@/lib/qr";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/auth/rateLimit";
import { getRequestContext } from "@/lib/http/requestContext";
import { logWarn } from "@/lib/observability/logger";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type Params = { token: string };

async function _GET(req: NextRequest, context: { params: Params | Promise<Params> }) {
  const ctx = getRequestContext(req);
  const limiter = await rateLimit(req, {
    windowMs: 60 * 1000,
    max: 60,
    keyPrefix: "qr",
  });
  if (!limiter.allowed) {
    logWarn("qr.rate_limited", { requestId: ctx.requestId, retryAfter: limiter.retryAfter });
    return jsonWrap(
      {
        ok: false,
        errorCode: "RATE_LIMITED",
        message: "Demasiados pedidos. Tenta novamente dentro de alguns minutos.",
        retryable: true,
      },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
    );
  }

  const { token } = await context.params;
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!trimmed) {
    logWarn("qr.invalid_token", { requestId: ctx.requestId });
    return jsonWrap({ error: "INVALID_TOKEN" }, { status: 400 });
  }

  const theme = req.nextUrl.searchParams.get("theme") === "dark" ? "dark" : "light";

  const tokenHash = crypto.createHash("sha256").update(trimmed).digest("hex");
  const tokenRow = await prisma.entitlementQrToken.findUnique({
    where: { tokenHash },
    select: {
      expiresAt: true,
      entitlement: {
        select: {
          id: true,
          eventId: true,
          ownerUserId: true,
        },
      },
    },
  });

  if (!tokenRow?.entitlement) {
    logWarn("qr.invalid_token", { requestId: ctx.requestId });
    return jsonWrap({ error: "INVALID_TOKEN" }, { status: 404 });
  }
  if (tokenRow.expiresAt && tokenRow.expiresAt < new Date()) {
    logWarn("qr.expired_token", { requestId: ctx.requestId });
    return jsonWrap({ error: "TOKEN_EXPIRED" }, { status: 410 });
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = tokenRow.expiresAt
    ? Math.floor(tokenRow.expiresAt.getTime() / 1000)
    : nowSec + 60 * 60;

  const qrPayload =
    typeof tokenRow.entitlement.eventId === "number"
      ? signTicketToORYA2({
          qrToken: trimmed,
          ticketId: tokenRow.entitlement.id,
          eventId: tokenRow.entitlement.eventId,
          userId: tokenRow.entitlement.ownerUserId ?? null,
          issuedAtSec: nowSec,
          expSec,
        })
      : trimmed;

  const dataUrl = await generateQR(qrPayload, { theme });
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    return jsonWrap({ error: "QR_GENERATION_FAILED" }, { status: 500 });
  }

  const buffer = Buffer.from(base64, "base64");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
export const GET = withApiEnvelope(_GET);
