export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { POST as postOrgLeave } from "@/lib/messages/handlers/chat/conversations/[conversationId]/leave/route";
import { getMessagesScope } from "@/app/api/messages/_scope";
import { jsonWrap } from "@/lib/api/wrapResponse";

export async function POST(req: NextRequest, context: { params: { conversationId: string } }) {
  const scope = getMessagesScope(req);
  if (scope === "b2c") {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  return postOrgLeave(req, context);
}
