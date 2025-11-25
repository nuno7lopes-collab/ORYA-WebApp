// app/api/qr/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  if (typeof token !== "string" || !token.trim()) {
    return new NextResponse("Missing token", { status: 400 });
  }

  try {
    const png = await QRCode.toBuffer(token, {
      type: "png",
      width: 512,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    return new NextResponse(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    console.error("[QR] Error generating:", err);
    return new NextResponse("Error generating QR", { status: 500 });
  }
}