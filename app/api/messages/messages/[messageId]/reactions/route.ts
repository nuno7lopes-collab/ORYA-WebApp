export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  POST as postOrgReaction,
  DELETE as deleteOrgReaction,
} from "@/lib/messages/handlers/chat/messages/[messageId]/reactions/route";

export async function POST(req: NextRequest, context: { params: { messageId: string } }) {
  return postOrgReaction(req, context);
}

export async function DELETE(req: NextRequest, context: { params: { messageId: string } }) {
  return deleteOrgReaction(req, context);
}
