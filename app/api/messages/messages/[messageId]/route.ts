export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  PATCH as patchOrgMessage,
  DELETE as deleteOrgMessage,
} from "@/lib/messages/handlers/chat/messages/[messageId]/route";

export async function PATCH(req: NextRequest, context: { params: { messageId: string } }) {
  return patchOrgMessage(req, context);
}

export async function DELETE(req: NextRequest, context: { params: { messageId: string } }) {
  return deleteOrgMessage(req, context);
}
