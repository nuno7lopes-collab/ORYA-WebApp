import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "CHAT_INTERNO_EM_BETA" },
    { status: 501 },
  );
}
