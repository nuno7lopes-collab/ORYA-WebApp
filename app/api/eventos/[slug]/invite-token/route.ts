import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils/email";
import { rateLimit } from "@/lib/auth/rateLimit";
import { assertInviteTokenValid, hashInviteToken } from "@/lib/invites/inviteTokens";
import { evaluateEventAccess } from "@/domain/access/evaluateAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const limiter = await rateLimit(req, { windowMs: 5 * 60 * 1000, max: 10, keyPrefix: "invite_token" });
  if (!limiter.allowed) {
    return jsonWrap({ ok: false, allow: false }, { status: 429 });
  }

  const resolved = await params;
  const body = (await req.json().catch(() => null)) as {
    token?: string;
    email?: string;
    ticketTypeId?: number | null;
  } | null;

  const inviteToken = typeof body?.token === "string" ? body.token.trim() : "";
  const emailNormalized = normalizeEmail(typeof body?.email === "string" ? body.email.trim() : "");
  const ticketTypeId =
    typeof body?.ticketTypeId === "number" && Number.isFinite(body.ticketTypeId)
      ? body.ticketTypeId
      : null;

  if (!inviteToken || !emailNormalized) {
    return jsonWrap({ ok: true, allow: false });
  }

  const event = await prisma.event.findUnique({
    where: { slug: resolved.slug },
    select: { id: true },
  });
  if (!event) {
    return jsonWrap({ ok: true, allow: false });
  }

  const accessDecision = await evaluateEventAccess({ eventId: event.id, intent: "INVITE_TOKEN" });
  if (!accessDecision.allowed) {
    return jsonWrap({ ok: true, allow: false });
  }

  const tokenHash = hashInviteToken(inviteToken);
  const tokenRow = await prisma.inviteToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      eventId: true,
      ticketTypeId: true,
      emailNormalized: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  const ok = assertInviteTokenValid({
    tokenRow,
    eventId: event.id,
    emailNormalized,
    ticketTypeIds: ticketTypeId ? [ticketTypeId] : [],
    now: new Date(),
  });

  if (!ok) {
    return jsonWrap({ ok: true, allow: false });
  }

  return jsonWrap({ ok: true, allow: true, expiresAt: tokenRow!.expiresAt });
}
export const POST = withApiEnvelope(_POST);