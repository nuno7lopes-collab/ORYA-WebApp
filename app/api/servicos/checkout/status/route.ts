import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  return NextResponse.json(
    { ok: false, error: "CHECKOUT_DEPRECATED", message: "Fluxo antigo de pagamento foi desativado." },
    { status: 410 },
  );
}
