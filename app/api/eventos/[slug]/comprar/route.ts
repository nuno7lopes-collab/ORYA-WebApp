import { NextRequest, NextResponse } from "next/server";

type RouteParams = { params: { slug: string } };

export async function POST(req: NextRequest, context: RouteParams) {
  const { slug } = context.params;

  let body: { ticketId?: string; quantity?: number } = {};
  try {
    body = await req.json();
  } catch {
    // ignore JSON parse errors, body remains empty
  }

  const { ticketId, quantity } = body;

  return NextResponse.json(
    {
      ok: true,
      slug,
      message: "Endpoint placeholder: usa o fluxo /checkout para comprar bilhetes.",
      ticketId,
      quantity,
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json(
    { error: "Method GET not allowed, only POST supported." },
    { status: 405 }
  );
}
