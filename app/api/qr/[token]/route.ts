export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { generateQR } from "@/lib/qr";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type Params = { token: string };

async function _GET(req: NextRequest, context: { params: Params | Promise<Params> }) {
  const { token } = await context.params;
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!trimmed) {
    return jsonWrap({ error: "INVALID_TOKEN" }, { status: 400 });
  }

  const theme = req.nextUrl.searchParams.get("theme") === "dark" ? "dark" : "light";

  const dataUrl = await generateQR(
    { v: "1", t: trimmed, ts: Date.now() },
    { theme },
  );
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    return jsonWrap({ error: "QR_GENERATION_FAILED" }, { status: 500 });
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
export const GET = withApiEnvelope(_GET);