export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  POST as postOrgReaction,
  DELETE as deleteOrgReaction,
} from "@/lib/messages/handlers/chat/messages/[messageId]/reactions/route";
import {
  POST as postB2CReaction,
  DELETE as deleteB2CReaction,
} from "@/lib/messages/handlers/me/messages/messages/[messageId]/reactions/route";
import { enforceB2CMobileOnly, getMessagesScope } from "@/app/api/messages/_scope";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  const mobileGate = enforceB2CMobileOnly(req);
  if (mobileGate) return mobileGate;
  const scope = getMessagesScope(req);
  const params = await context.params;
  if (scope === "b2c") {
    return postB2CReaction(req, { params });
  }
  return postOrgReaction(req, { params });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  const mobileGate = enforceB2CMobileOnly(req);
  if (mobileGate) return mobileGate;
  const scope = getMessagesScope(req);
  const params = await context.params;
  if (scope === "b2c") {
    return deleteB2CReaction(req, { params });
  }
  return deleteOrgReaction(req, { params });
}
