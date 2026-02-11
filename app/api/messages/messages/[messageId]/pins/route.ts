export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  POST as postOrgPin,
  DELETE as deleteOrgPin,
} from "@/lib/messages/handlers/chat/messages/[messageId]/pins/route";

export async function POST(req: NextRequest, context: { params: { messageId: string } }) {
  return postOrgPin(req, context);
}

export async function DELETE(req: NextRequest, context: { params: { messageId: string } }) {
  return deleteOrgPin(req, context);
}
