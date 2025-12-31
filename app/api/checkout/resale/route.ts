import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Revenda temporariamente desativada.", code: "RESALE_DISABLED" },
    { status: 403 },
  );
}
