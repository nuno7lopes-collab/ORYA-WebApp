// app/api/qr/validate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ENTERPRISE S2 — ORYA2 SIGNATURE VALIDATION
 *
 * Aceita apenas payloads formados como:
 * ORYA2:<base64urlPayload>.<base64urlSignature>
 *
 * Valida:
 *  - Formato
 *  - Base64
 *  - JSON interno
 *  - Campos obrigatórios
 *  - HMAC SHA256 correto
 *  - Token existe e corresponde ao QR
 *  - Ticket não expirou
 */

export async function GET(req: NextRequest) {
  // ❌ PUBLIC QR VALIDATION IS DISABLED
  return NextResponse.json(
    { ok: false, error: "PUBLIC_QR_VALIDATION_DISABLED" },
    { status: 403 }
  );
  /*
  try {
    const url = req.nextUrl;
    const searchParams = url.searchParams;
    const raw = searchParams.get("token");

    if (!raw) {
      return NextResponse.json(
        { ok: false, error: "MISSING_TOKEN" },
        { status: 400 }
      );
    }

    // ---------------------------
    // 1) Verificar prefixo ORYA2
    // ---------------------------
    if (!raw.startsWith("ORYA2:")) {
      return NextResponse.json(
        { ok: false, error: "INVALID_FORMAT_OR_PREFIX" },
        { status: 400 }
      );
    }

    const stripped = raw.replace("ORYA2:", "");
    const parts = stripped.split(".");

    if (parts.length !== 2) {
      return NextResponse.json(
        { ok: false, error: "INVALID_FORMAT_PARTS" },
        { status: 400 }
      );
    }

    const [payloadB64, sigB64] = parts;

    // ---------------------------
    // 2) Decodificar payload
    // ---------------------------
    let payloadJson: any;
    try {
      const jsonString = Buffer.from(payloadB64, "base64url").toString();
      payloadJson = JSON.parse(jsonString);
    } catch {
      return NextResponse.json(
        { ok: false, error: "INVALID_PAYLOAD_B64_OR_JSON" },
        { status: 400 }
      );
    }

    const required = ["v", "tok", "tid", "eid", "uid", "ts", "exp"];
    for (const key of required) {
      if (!(key in payloadJson)) {
        return NextResponse.json(
          { ok: false, error: `MISSING_FIELD_${key}` },
          { status: 400 }
        );
      }
    }

    // ---------------------------
    // 3) Verificar assinatura HMAC SHA256
    // ---------------------------
    const secret = env.qrSecretKey;
    if (!secret) {
      return NextResponse.json(
        { ok: false, error: "SERVER_MISCONFIGURED_NO_SECRET" },
        { status: 500 }
      );
    }

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payloadB64);
    const expectedSig = hmac.digest("base64url");

    if (expectedSig !== sigB64) {
      return NextResponse.json(
        { ok: false, error: "INVALID_SIGNATURE" },
        { status: 400 }
      );
    }

    // ---------------------------
    // 4) Verificar expiração
    // ---------------------------
    const nowSec = Math.floor(Date.now() / 1000);
    if (payloadJson.exp < nowSec) {
      return NextResponse.json(
        { ok: false, error: "TICKET_EXPIRED" },
        { status: 400 }
      );
    }

    // ---------------------------
    // 5) Lookup real no DB para confirmar tok
    // ---------------------------
    const purchase = await prisma.ticketPurchase.findUnique({
      where: { qrToken: payloadJson.tok },
      include: { event: true, ticket: true },
    });

    // Confirm seed matches DB
    if (purchase.rotatingSeed && payloadJson.seed !== purchase.rotatingSeed) {
      return NextResponse.json(
        { ok: false, error: "SEED_MISMATCH" },
        { status: 400 }
      );
    }

    if (!purchase) {
      return NextResponse.json(
        { ok: false, error: "TOKEN_NOT_FOUND_IN_DB" },
        { status: 404 }
      );
    }

    // ---------------------------
    // 6) S3 — Marcação de entrada (anti‑reutilização)
    // ---------------------------

    // Se já foi usado → inválido
    if (purchase.usedAt) {
      return NextResponse.json(
        { ok: false, error: "TICKET_ALREADY_USED" },
        { status: 400 }
      );
    }

    // Caso exista remainingEntries (multi‑entrada)
    if (typeof purchase.remainingEntries === "number") {
      if (purchase.remainingEntries <= 0) {
        return NextResponse.json(
          { ok: false, error: "NO_ENTRIES_LEFT" },
          { status: 400 }
        );
      }

      // decremento seguro
      await prisma.ticketPurchase.update({
        where: { id: purchase.id },
        data: { remainingEntries: purchase.remainingEntries - 1 },
      });
    } else {
      // Caso seja single-entry → marcar usado
      await prisma.ticketPurchase.update({
        where: { id: purchase.id },
        data: { usedAt: new Date() },
      });
    }

    // ---------------------------
    // 6) Validado
    // ---------------------------
    return NextResponse.json(
      {
        ok: true,
        message: "VALID_ORYA2_QR",
        data: {
          purchaseId: purchase.id,
          userId: purchase.userId,
          event: {
            id: purchase.event.id,
            title: purchase.event.title,
            slug: purchase.event.slug,
            startDate: purchase.event.startDate,
            endDate: purchase.event.endDate,
          },
          ticket: {
            id: purchase.ticket.id,
            name: purchase.ticket.name,
          },
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[QR VALIDATE ERROR]", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
  */
}