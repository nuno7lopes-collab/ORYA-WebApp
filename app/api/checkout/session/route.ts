// app/api/checkout/session/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

// ⚠️ AVISO
// Esta rota de Stripe Checkout (sessions) foi descontinuada em favor
// do fluxo baseado em Payment Intent (/api/payments/intent).
// Mantemos a rota apenas para não partir nada a nível de imports antigos
// e para o typechecker ficar limpo.

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: "CHECKOUT_SESSION_DISABLED",
      message:
        "Este endpoint foi descontinuado. Usa o fluxo de pagamentos atual baseado em Payment Intents.",
    },
    { status: 400 }
  );
}