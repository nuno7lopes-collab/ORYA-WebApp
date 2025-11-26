// app/api/qr/[token]/route.ts
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { buildQrToken } from "@/lib/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: { token: string } | Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (typeof token !== "string" || !token.trim()) {
    return new NextResponse("Missing token", { status: 400 });
  }

  try {
    // Carregar o bilhete real para poder gerar payload rotativo (ORYA2)
    const ticket = await prisma.ticket.findUnique({
      where: { qrSecret: token },
      include: {
        event: {
          select: { id: true },
        },
      },
    });

    if (!ticket) {
      return new NextResponse("Ticket not found", { status: 404 });
    }

    // Garantir seed para rotação
    let rotatingSeed = ticket.rotatingSeed ?? null;
    if (!rotatingSeed) {
      rotatingSeed = crypto.randomUUID();
      try {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { rotatingSeed },
        });
      } catch (err) {
        console.error("[QR] Falha a guardar rotatingSeed", err);
      }
    }

    const signedPayload = buildQrToken({
      ticketId: ticket.id,
      eventId: ticket.eventId,
      userId: ticket.userId ?? null,
      qrToken: token,
      lifetimeSeconds: 60 * 60 * 8,
      seed: rotatingSeed ?? undefined,
      useRotationWindow: true,
    });

    const png = await QRCode.toBuffer(signedPayload, {
      type: "png",
      width: 512,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    return new NextResponse(png, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("[QR] Error generating:", err);
    return new NextResponse("Error generating QR", { status: 500 });
  }
}
