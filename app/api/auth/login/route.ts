import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isSameOriginOrApp } from "@/lib/auth/requestValidation";
import { rateLimit } from "@/lib/auth/rateLimit";

function isUnconfirmedError(err: unknown) {
  if (!err) return false;
  const anyErr = err as { message?: string; error_description?: string };
  const msg = (anyErr.message || anyErr.error_description || "").toLowerCase();
  return (
    msg.includes("not confirmed") ||
    msg.includes("confirm your email") ||
    msg.includes("email_not_confirmed")
  );
}

function normalizeIdentifier(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("@")) return trimmed.slice(1);
  return trimmed;
}

export async function POST(req: NextRequest) {
  if (!isSameOriginOrApp(req)) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { identifier?: string; password?: string }
    | null;
  const identifierRaw = body?.identifier ?? "";
  const password = body?.password ?? "";
  const identifier = normalizeIdentifier(identifierRaw);

  const limiter = await rateLimit(req, {
    windowMs: 5 * 60 * 1000,
    max: 10,
    keyPrefix: "auth:login",
    identifier,
  });
  if (!limiter.allowed) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } }
    );
  }

  if (!identifier || !password) {
    return NextResponse.json(
      { ok: false, error: "MISSING_CREDENTIALS" },
      { status: 400 }
    );
  }

  try {
    let email = identifier.toLowerCase();
    if (!email.includes("@")) {
      const profile = await prisma.profile.findFirst({
        where: { username: { equals: identifier, mode: "insensitive" } },
        select: { id: true },
      });
      if (!profile) {
        return NextResponse.json(
          { ok: false, error: "INVALID_CREDENTIALS" },
          { status: 401 }
        );
      }
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(
        profile.id
      );
      if (error || !data?.user?.email) {
        return NextResponse.json(
          { ok: false, error: "INVALID_CREDENTIALS" },
          { status: 401 }
        );
      }
      email = data.user.email.toLowerCase();
    }

    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data?.session) {
      if (isUnconfirmedError(error)) {
        return NextResponse.json(
          { ok: false, error: "EMAIL_NOT_CONFIRMED" },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { ok: false, error: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (err) {
    console.error("[auth/login] error:", err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
