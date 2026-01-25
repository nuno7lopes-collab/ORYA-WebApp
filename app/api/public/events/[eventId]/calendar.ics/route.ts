import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "PUBLIC_ICS_GONE" }, { status: 410 });
}
