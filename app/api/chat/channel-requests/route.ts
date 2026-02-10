export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/auth/rateLimit";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ADMIN_ROLES = new Set(["OWNER", "CO_OWNER", "ADMIN"]);

function parseLimit(value: string | null) {
  const raw = Number(value ?? "30");
  if (!Number.isFinite(raw)) return 30;
  return Math.min(Math.max(raw, 1), 100);
}

async function _GET(req: NextRequest) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization, membership } = await requireChatContext(req);
    if (!membership?.role || !ADMIN_ROLES.has(membership.role)) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const limiter = await rateLimit(req, {
      windowMs: 10 * 1000,
      max: 40,
      keyPrefix: "chat:channel-requests",
      identifier: user.id,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const items = await prisma.chatChannelRequest.findMany({
      where: { organizationId: organization.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        requester: {
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        },
      },
    });

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("GET /api/chat/channel-requests error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar pedidos." }, { status: 500 });
  }
}

async function _POST(req: NextRequest) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization, membership } = await requireChatContext(req);

    const limiter = await rateLimit(req, {
      windowMs: 60 * 1000,
      max: 20,
      keyPrefix: "chat:channel-requests:create",
      identifier: user.id,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const payload = (await req.json().catch(() => null)) as { title?: unknown } | null;
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    if (title.length < 2) {
      return jsonWrap({ ok: false, error: "INVALID_TITLE" }, { status: 400 });
    }

    if (membership?.role && ADMIN_ROLES.has(membership.role)) {
      return jsonWrap({ ok: false, error: "ADMIN_CAN_CREATE" }, { status: 400 });
    }

    const request = await prisma.chatChannelRequest.create({
      data: {
        organizationId: organization.id,
        requesterId: user.id,
        title,
      },
      select: { id: true, status: true, createdAt: true },
    });

    return jsonWrap({ ok: true, request }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/chat/channel-requests error:", err);
    return jsonWrap({ ok: false, error: "Erro ao criar pedido." }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
