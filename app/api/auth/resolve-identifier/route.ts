export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const WINDOW_MS = 5 * 60 * 1000; // 5 minutos
const MAX_ATTEMPTS = 20;
const ipHits = new Map<string, number[]>();

function getClientIp(req: NextRequest) {
  const header = req.headers.get("x-forwarded-for") || "";
  const first = header.split(",")[0]?.trim();
  return first || "unknown";
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const hits = ipHits.get(ip)?.filter((ts) => ts > windowStart) ?? [];
  hits.push(now);
  ipHits.set(ip, hits);
  return hits.length > MAX_ATTEMPTS;
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const visibleUser = user.slice(0, 2);
  return `${visibleUser}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
    }

    const body = (await req.json().catch(() => null)) as { identifier?: string } | null;
    const identifier = body?.identifier?.trim();

    if (!identifier) {
      return NextResponse.json({ ok: false, error: "IDENTIFIER_REQUIRED" }, { status: 400 });
    }

    // 1) Se for email, devolve-o normalizado (para login por email/password)
    if (identifier.includes("@")) {
      const normalized = identifier.toLowerCase();
      return NextResponse.json({
        ok: true,
        email: normalized,
        emailMasked: maskEmail(normalized),
        message: "Se existir conta, receberás instruções.",
      });
    }

    // 2) Se for username, tenta resolver para email real
    const profile = await prisma.profile.findFirst({
      where: { username: { equals: identifier, mode: "insensitive" } },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.getUserById(profile.id);

    if (error || !data?.user?.email) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const email = data.user.email.toLowerCase();
    return NextResponse.json({
      ok: true,
      email,
      emailMasked: maskEmail(email),
      message: "Conta encontrada.",
    });
  } catch (err) {
    console.error("[resolve-identifier] error", err);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
