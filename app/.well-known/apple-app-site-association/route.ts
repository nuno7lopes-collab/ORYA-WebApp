import { NextResponse } from "next/server";
import { getAppleUniversalLinksConfig } from "@/lib/apple/universalLinks";

export async function GET() {
  try {
    const cfg = getAppleUniversalLinksConfig();
    const body = {
      applinks: {
        apps: [],
        details: [
          {
            appID: cfg.appId,
            paths: ["/eventos/*", "/bilhetes/*", "/*"],
          },
        ],
      },
    };

    return NextResponse.json(body, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "APPLE_UNIVERSAL_LINKS_CONFIG_MISSING" },
      { status: 500 },
    );
  }
}
