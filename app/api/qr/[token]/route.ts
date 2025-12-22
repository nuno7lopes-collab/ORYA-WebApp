export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { generateQR } from "@/lib/qr";

type Params = { token: string };

export async function GET(req: NextRequest, context: { params: Params | Promise<Params> }) {
  const { token } = await context.params;
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!trimmed) {
    return NextResponse.json({ error: "INVALID_TOKEN" }, { status: 400 });
  }

  const theme = req.nextUrl.searchParams.get("theme") === "dark" ? "dark" : "light";

  const dataUrl = await generateQR(
    { v: "1", t: trimmed, ts: Date.now() },
    { theme },
  );
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    return NextResponse.json({ error: "QR_GENERATION_FAILED" }, { status: 500 });
  }

  const buffer = Buffer.from(base64, "base64");

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
