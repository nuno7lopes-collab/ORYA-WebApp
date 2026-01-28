import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { isAppRequest, isSameOriginOrApp } from "@/lib/auth/requestValidation";
import { rateLimit } from "@/lib/auth/rateLimit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

/**
 * Endpoint simples para verificar se um email está bloqueado por conta PENDING_DELETE.
 * GET /api/auth/check-email?email=...
 */
async function _GET(req: NextRequest) {
  try {
    if (!isSameOriginOrApp(req)) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const email = req.nextUrl.searchParams.get("email");
    if (!email || !email.includes("@")) {
      return jsonWrap({ ok: false, error: "INVALID_EMAIL" }, { status: 400 });
    }
    const normalized = email.trim().toLowerCase();

    const limiter = await rateLimit(req, {
      windowMs: 5 * 60 * 1000,
      max: 10,
      keyPrefix: "auth:check-email",
      identifier: normalized,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } }
      );
    }
    const allowDetails = isAppRequest(req);
    if (!allowDetails) {
      return jsonWrap(
        {
          ok: true,
          blocked: false,
          message: "Se existir conta, receberás instruções.",
        },
        { status: 200 },
      );
    }

    const authUser = await prisma.users.findFirst({
      where: { email: normalized },
      select: { id: true },
    });
    const pending = authUser
      ? await prisma.profile.findFirst({
          where: { id: authUser.id, status: "PENDING_DELETE" },
          select: { deletionScheduledFor: true },
        })
      : null;
    if (pending) {
      return jsonWrap(
        {
          ok: true,
          blocked: true,
          message:
            "Este email está associado a uma conta marcada para eliminação. Inicia sessão para a recuperar ou usa outro email.",
          deletionScheduledFor: pending.deletionScheduledFor,
        },
        { status: 200 },
      );
    }
    return jsonWrap({ ok: true, blocked: false }, { status: 200 });
  } catch (err) {
    console.error("[auth/check-email] erro", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);