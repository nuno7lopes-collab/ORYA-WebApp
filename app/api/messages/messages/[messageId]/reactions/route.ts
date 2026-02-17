export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  POST as postOrgReaction,
  DELETE as deleteOrgReaction,
} from "@/lib/messages/handlers/chat/messages/[messageId]/reactions/route";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  const params = await context.params;
  return postOrgReaction(req, { params });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  const params = await context.params;
  return deleteOrgReaction(req, { params });
}
