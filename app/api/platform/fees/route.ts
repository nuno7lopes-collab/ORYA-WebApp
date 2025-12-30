import { NextResponse } from "next/server";
import { getPlatformAndStripeFees } from "@/lib/platformSettings";

export async function GET() {
  try {
    const { orya, stripe } = await getPlatformAndStripeFees();
    return NextResponse.json({ ok: true, orya, stripe }, { status: 200 });
  } catch (err) {
    console.error("[platform/fees] unexpected error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
