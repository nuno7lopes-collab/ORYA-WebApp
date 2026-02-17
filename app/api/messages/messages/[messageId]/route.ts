export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  PATCH as patchOrgMessage,
  DELETE as deleteOrgMessage,
} from "@/lib/messages/handlers/chat/messages/[messageId]/route";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  const params = await context.params;
  return patchOrgMessage(req, { params });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  const params = await context.params;
  return deleteOrgMessage(req, { params });
}
