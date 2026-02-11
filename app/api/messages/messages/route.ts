export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { POST as postOrgMessage } from "@/lib/messages/handlers/chat/messages/route";
import { POST as postBookingMessage } from "@/lib/messages/handlers/chat/bookings/[bookingId]/messages/route";
import { cloneWithJsonBody } from "@/app/api/messages/_scope";

function parseBookingId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const bookingId = parseBookingId(payload?.bookingId);
  const conversationId =
    typeof payload?.conversationId === "string" ? payload.conversationId.trim() : "";

  if (bookingId && !conversationId) {
    const delegatedReq = await cloneWithJsonBody(req, {
      body: payload?.body,
      clientMessageId: payload?.clientMessageId,
    });
    return postBookingMessage(delegatedReq, { params: { bookingId: String(bookingId) } });
  }

  const delegatedReq = await cloneWithJsonBody(req, payload ?? {});
  return postOrgMessage(delegatedReq);
}
