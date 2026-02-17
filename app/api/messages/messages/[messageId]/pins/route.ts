export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  POST as postOrgPin,
  DELETE as deleteOrgPin,
} from "@/lib/messages/handlers/chat/messages/[messageId]/pins/route";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  const params = await context.params;
  return postOrgPin(req, { params });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  const params = await context.params;
  return deleteOrgPin(req, { params });
}
