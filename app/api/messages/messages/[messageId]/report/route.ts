export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { POST as postOrgReport } from "@/lib/messages/handlers/chat/messages/[messageId]/report/route";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ messageId: string }> | { messageId: string } },
) {
  const params = await context.params;
  return postOrgReport(req, { params });
}
