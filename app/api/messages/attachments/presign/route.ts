export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { POST as postOrgAttachmentPresign } from "@/lib/messages/handlers/chat/attachments/presign/route";

export async function POST(req: NextRequest) {
  return postOrgAttachmentPresign(req);
}
