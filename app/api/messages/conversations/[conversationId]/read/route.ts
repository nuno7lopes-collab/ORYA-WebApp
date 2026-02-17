export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { POST as postOrgRead } from "@/lib/messages/handlers/chat/conversations/[conversationId]/read/route";
import { POST as postB2CRead } from "@/lib/messages/handlers/me/messages/conversations/[conversationId]/read/route";
import { enforceB2CMobileOnly, getMessagesScope } from "@/app/api/messages/_scope";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> | { conversationId: string } },
) {
  const mobileGate = enforceB2CMobileOnly(req);
  if (mobileGate) return mobileGate;
  const scope = getMessagesScope(req);
  const params = await context.params;
  if (scope === "b2c") {
    return postB2CRead(req, { params });
  }
  return postOrgRead(req, { params });
}
