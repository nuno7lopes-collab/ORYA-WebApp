import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";

export async function GET(_req: NextRequest) {
  return jsonWrap(
    {
      ok: false,
      error: "LEGACY_ROUTE_REMOVED",
      errorCode: "LEGACY_ROUTE_REMOVED",
      namespace: "web",
    },
    { status: 410 },
  );
}
