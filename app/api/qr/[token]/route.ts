// app/api/qr/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;

  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
  }

  // Verificar se este token existe na DB
  const purchase = await prisma.ticketPurchase.findFirst({
    where: { qrToken: token }
  });

  if (!purchase) {
    return new NextResponse("QR inválido", { status: 404 });
  }

  // Criar payload do QR:
  const qrPayload = JSON.stringify({
    type: "ORYA_TICKET",
    ticketId: purchase.id,
    qrToken: purchase.qrToken,
    eventId: purchase.eventId,
    ts: Date.now()
  });

  try {
    const svg = await QRCode.toString(qrPayload, {
      type: "svg",
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store"
      }
    });
  } catch (err) {
    console.error("QR ERROR", err);
    return new NextResponse("Erro a gerar QR", { status: 500 });
  }
}