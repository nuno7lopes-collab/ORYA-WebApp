export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { DELETE as deleteOrgMessage } from "@/lib/messages/handlers/chat/messages/[messageId]/route";
import { DELETE as deleteB2CMessage } from "@/lib/messages/handlers/me/messages/conversations/[conversationId]/messages/[messageId]/route";
import { getMessagesScope } from "@/app/api/messages/_scope";

export async function DELETE(
  req: NextRequest,
  context: { params: { conversationId: string; messageId: string } },
) {
  const scope = getMessagesScope(req);
  if (scope === "b2c") {
    return deleteB2CMessage(req, context);
  }

  return deleteOrgMessage(req, { params: { messageId: context.params.messageId } });
}
