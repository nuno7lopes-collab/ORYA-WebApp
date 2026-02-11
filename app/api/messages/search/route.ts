export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { GET as getOrgSearch } from "@/lib/messages/handlers/chat/search/route";

export async function GET(req: NextRequest) {
  return getOrgSearch(req);
}
