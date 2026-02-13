export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { PATCH as patchOrgNotifications } from "@/lib/messages/handlers/chat/conversations/[conversationId]/notifications/route";
import { PATCH as patchB2CNotifications } from "@/lib/messages/handlers/me/messages/conversations/[conversationId]/notifications/route";
import { enforceB2CMobileOnly, getMessagesScope } from "@/app/api/messages/_scope";

export async function PATCH(req: NextRequest, context: { params: { conversationId: string } }) {
  const mobileGate = enforceB2CMobileOnly(req);
  if (mobileGate) return mobileGate;
  const scope = getMessagesScope(req);
  if (scope === "b2c") {
    return patchB2CNotifications(req, context);
  }
  return patchOrgNotifications(req, context);
}
