import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: "BOOKING_CONFIRM_DEPRECATED",
      message: "A reserva é confirmada automaticamente após o pagamento.",
    },
    { status: 410 },
  );
}
