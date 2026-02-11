export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { POST as postOrgRead } from "@/lib/messages/handlers/chat/conversations/[conversationId]/read/route";
import { POST as postB2CRead } from "@/lib/messages/handlers/me/messages/conversations/[conversationId]/read/route";
import { getMessagesScope } from "@/app/api/messages/_scope";

export async function POST(req: NextRequest, context: { params: { conversationId: string } }) {
  const scope = getMessagesScope(req);
  if (scope === "b2c") {
    return postB2CRead(req, context);
  }
  return postOrgRead(req, context);
}
