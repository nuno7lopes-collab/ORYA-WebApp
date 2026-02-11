export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { GET as getOrgThread } from "@/lib/messages/handlers/chat/conversations/[conversationId]/threads/[messageId]/route";

export async function GET(
  req: NextRequest,
  context: { params: { conversationId: string; messageId: string } },
) {
  return getOrgThread(req, context);
}
