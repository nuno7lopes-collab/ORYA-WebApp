import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

export const runtime = "nodejs";

async function _POST(_req: NextRequest) {
  return jsonWrap(
    {
      ok: false,
      error: "BOOKING_CONFIRM_DEPRECATED",
      message: "A reserva é confirmada automaticamente após o pagamento.",
    },
    { status: 410 },
  );
}
export const POST = withApiEnvelope(_POST);