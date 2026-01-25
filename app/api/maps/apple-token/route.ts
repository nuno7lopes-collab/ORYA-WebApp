import { NextRequest, NextResponse } from "next/server";
import { getAppleMapsConfig } from "@/lib/maps/appleConfig";
import { mintAppleMapsToken } from "@/lib/maps/appleToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const cfg = getAppleMapsConfig({ allowMissingInDev: true });
    if (!cfg) {
      return NextResponse.json({ ok: false, provider: "osm" }, { status: 200 });
    }
    const { token, expiresAt } = mintAppleMapsToken();
    return NextResponse.json({ ok: true, token, expiresAt }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apple Maps creds missing";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
