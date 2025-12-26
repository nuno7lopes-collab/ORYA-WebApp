// app/api/eventos/route.ts
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: "A criação de eventos agora é feita por organizações.",
      code: "ORGANIZATION_REQUIRED",
    },
    { status: 403 },
  );
}
