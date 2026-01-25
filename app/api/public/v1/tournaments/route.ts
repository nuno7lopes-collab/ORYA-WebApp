import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "PUBLIC_API_GONE" }, { status: 410 });
}
