import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * QR VALIDATION — S1 ULTRA (Future‑proof)
 *
 * Features:
 * ✔ Input sanitization & format checks
 * ✔ Anti‑flood soft rate‑limit (in‑memory)
 * ✔ Minimal leakage of internal data
 * ✔ Future-ready hooks for S2 (signatures, usedAt)
 * ✔ Validation logs (no DB changes yet — soft logging)
 *
 * GET /api/qr/validate?token=xxxx
 */

const RATE_LIMIT_WINDOW = 6000; // 6s
const RATE_LIMIT_MAX = 6;

const rateMemory = new Map<string, { count: number; ts: number }>();

function applyRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateMemory.get(ip);

  if (!record) {
    rateMemory.set(ip, { count: 1, ts: now });
    return false;
  }

  if (now - record.ts > RATE_LIMIT_WINDOW) {
    rateMemory.set(ip, { count: 1, ts: now });
    return false;
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX) return true;

  return false;
}

export async function GET(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  if (applyRateLimit(ip)) {
    console.warn("[QR VALIDATE] Rate limited:", ip);
    return NextResponse.json(
      { valid: false, reason: "rate_limited" },
      { status: 429 }
    );
  }

  try {
    const raw = req.nextUrl.searchParams.get("token");

    if (!raw) {
      return NextResponse.json(
        { valid: false, reason: "missing_token" },
        { status: 400 }
      );
    }

    const token = raw.trim();

    if (token.length < 12 || token.length > 200) {
      return NextResponse.json(
        { valid: false, reason: "invalid_format" },
        { status: 400 }
      );
    }

    // Soft unicode sanitization
    if (/[^a-zA-Z0-9\-_.]/.test(token)) {
      return NextResponse.json(
        { valid: false, reason: "invalid_characters" },
        { status: 400 }
      );
    }

    // 1) Lookup purchase
    const purchase = await prisma.ticketPurchase.findUnique({
      where: { qrToken: token },
      include: {
        event: true,
        ticket: true,
      },
    });

    if (!purchase) {
      console.log("[QR VALIDATE] Token not found:", token);
      return NextResponse.json(
        { valid: false, reason: "not_found" },
        { status: 404 }
      );
    }

    // FUTURE HOOK (S2): verify cryptographic signature here
    // FUTURE HOOK (S2): if purchase.usedAt → invalid

    const now = new Date();

    if (purchase.event.endDate && purchase.event.endDate < now) {
      return NextResponse.json(
        { valid: false, reason: "event_finished" },
        { status: 400 }
      );
    }

    // ULTRA: Soft log (stored only in memory for now)
    console.log("[QR VALIDATE] VALID SCAN", {
      ip,
      token,
      purchaseId: purchase.id,
      event: purchase.event.slug,
      at: now.toISOString(),
    });

    return NextResponse.json(
      {
        valid: true,
        ticket: {
          id: purchase.id,
          quantity: purchase.quantity,
        },
        event: {
          id: purchase.event.id,
          title: purchase.event.title,
          slug: purchase.event.slug,
          startDate: purchase.event.startDate,
          endDate: purchase.event.endDate,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[QR VALIDATE ERROR]", err);
    return NextResponse.json(
      { valid: false, reason: "server_error" },
      { status: 500 }
    );
  }
}
