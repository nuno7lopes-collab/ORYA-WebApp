export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { POST as postOrgReport } from "@/lib/messages/handlers/chat/messages/[messageId]/report/route";

export async function POST(req: NextRequest, context: { params: { messageId: string } }) {
  return postOrgReport(req, context);
}
