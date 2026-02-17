export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { GET as getOrgThread } from "@/lib/messages/handlers/chat/conversations/[conversationId]/threads/[messageId]/route";

export async function GET(
  req: NextRequest,
  context: {
    params:
      | Promise<{ conversationId: string; messageId: string }>
      | { conversationId: string; messageId: string };
  },
) {
  const params = await context.params;
  return getOrgThread(req, { params });
}
