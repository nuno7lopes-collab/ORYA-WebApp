export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { PATCH as patchOrgConversation } from "@/lib/messages/handlers/chat/conversations/[conversationId]/route";
import { enforceB2CMobileOnly, getMessagesScope } from "@/app/api/messages/_scope";
import { jsonWrap } from "@/lib/api/wrapResponse";

export async function PATCH(req: NextRequest, context: { params: { conversationId: string } }) {
  const mobileGate = enforceB2CMobileOnly(req);
  if (mobileGate) return mobileGate;
  const scope = getMessagesScope(req);
  if (scope === "b2c") {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  return patchOrgConversation(req, context);
}
