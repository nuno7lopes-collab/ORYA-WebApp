export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { GET as getOrgConversations, POST as postOrgConversations } from "@/lib/messages/handlers/chat/conversations/route";
import { GET as getB2CInbox } from "@/lib/messages/handlers/me/messages/inbox/route";
import { enforceB2CMobileOnly, getMessagesScope } from "@/app/api/messages/_scope";

export async function GET(req: NextRequest) {
  const mobileGate = enforceB2CMobileOnly(req);
  if (mobileGate) return mobileGate;
  const scope = getMessagesScope(req);
  if (scope === "b2c") {
    return getB2CInbox(req);
  }
  return getOrgConversations(req);
}

export async function POST(req: NextRequest) {
  const mobileGate = enforceB2CMobileOnly(req);
  if (mobileGate) return mobileGate;
  const scope = getMessagesScope(req);
  if (scope === "b2c") {
    return jsonWrap(
      { ok: false, error: "USE_CONVERSATION_RESOLVE" },
      { status: 400 },
    );
  }
  return postOrgConversations(req);
}
