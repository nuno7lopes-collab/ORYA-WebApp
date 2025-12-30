import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils/email";
import { validateUsername } from "@/lib/username";

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type CheckResult =
  | { ok: true; normalized: string; type: "email" | "username" }
  | { ok: false; error: string };

function normalizeIdentifier(raw: string): CheckResult {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Identificador vazio." };

  const explicitUsername = value.startsWith("@") && !value.slice(1).includes("@");
  if (explicitUsername) {
    const validation = validateUsername(value.slice(1));
    if (!validation.valid) return { ok: false, error: validation.error };
    return { ok: true, normalized: validation.normalized, type: "username" };
  }

  if (value.includes("@")) {
    if (!EMAIL_REGEX.test(value)) {
      return { ok: false, error: "Email inválido." };
    }
    const normalized = normalizeEmail(value);
    if (!normalized) return { ok: false, error: "Email inválido." };
    return { ok: true, normalized, type: "email" };
  }

  const validation = validateUsername(value);
  if (!validation.valid) return { ok: false, error: validation.error };
  return { ok: true, normalized: validation.normalized, type: "username" };
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const slug = params.slug;
    if (!slug) {
      return NextResponse.json({ ok: false, error: "SLUG_REQUIRED" }, { status: 400 });
    }

    let body: { identifier?: string; scope?: string } | null = null;
    try {
      body = (await req.json()) as { identifier?: string; scope?: string };
    } catch {
      return NextResponse.json({ ok: false, error: "BODY_INVALID" }, { status: 400 });
    }

    const identifier = typeof body?.identifier === "string" ? body.identifier : "";
    const normalized = normalizeIdentifier(identifier);
    if (!normalized.ok) {
      return NextResponse.json({ ok: false, error: normalized.error }, { status: 400 });
    }
    const scopeRaw = typeof body?.scope === "string" ? body.scope.trim().toUpperCase() : "";
    const scope = scopeRaw === "PARTICIPANT" ? "PARTICIPANT" : "PUBLIC";

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const invite = await prisma.eventInvite.findFirst({
      where: { eventId: event.id, targetIdentifier: normalized.normalized, scope },
      select: { id: true },
    });

    return NextResponse.json({
      ok: true,
      invited: Boolean(invite),
      type: normalized.type,
      normalized: normalized.normalized,
    });
  } catch (err) {
    console.error("[eventos/invites/check]", err);
    return NextResponse.json({ ok: false, error: "Erro ao validar convite." }, { status: 500 });
  }
}
