export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { GET as getOrgMessages } from "@/lib/messages/handlers/chat/conversations/[conversationId]/messages/route";
import { POST as postOrgMessage } from "@/lib/messages/handlers/chat/messages/route";
import {
  GET as getB2CMessages,
  POST as postB2CMessages,
} from "@/lib/messages/handlers/me/messages/conversations/[conversationId]/messages/route";
import { cloneWithJsonBody, enforceB2CMobileOnly, getMessagesScope } from "@/app/api/messages/_scope";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> | { conversationId: string } },
) {
  const mobileGate = enforceB2CMobileOnly(req);
  if (mobileGate) return mobileGate;
  const scope = getMessagesScope(req);
  const params = await context.params;
  if (scope === "b2c") {
    return getB2CMessages(req, { params });
  }
  return getOrgMessages(req, { params });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ conversationId: string }> | { conversationId: string } },
) {
  const mobileGate = enforceB2CMobileOnly(req);
  if (mobileGate) return mobileGate;
  const scope = getMessagesScope(req);
  const params = await context.params;
  if (scope === "b2c") {
    return postB2CMessages(req, { params });
  }

  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const conversationId = params.conversationId;
  const delegated = await cloneWithJsonBody(req, {
    ...(payload ?? {}),
    conversationId,
  });
  return postOrgMessage(delegated);
}
