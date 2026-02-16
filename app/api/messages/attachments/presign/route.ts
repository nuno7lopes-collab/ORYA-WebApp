export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { POST as postOrgAttachmentPresign } from "@/lib/messages/handlers/chat/attachments/presign/route";
import { enforceB2CMobileOnly } from "@/app/api/messages/_scope";

export async function POST(req: NextRequest) {
  const mobileGate = enforceB2CMobileOnly(req);
  if (mobileGate) return mobileGate;
  return postOrgAttachmentPresign(req);
}
