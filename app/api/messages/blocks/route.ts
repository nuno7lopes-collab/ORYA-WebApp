export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { POST as postBlock, DELETE as deleteBlock } from "@/lib/messages/handlers/chat/blocks/route";

export async function POST(req: NextRequest) {
  return postBlock(req);
}

export async function DELETE(req: NextRequest) {
  return deleteBlock(req);
}
