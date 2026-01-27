import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resend } from "@/lib/resend";
import { env } from "@/lib/env";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { normalizeAndValidateUsername, checkUsernameAvailability } from "@/lib/globalUsernames";
import { isSameOriginOrApp } from "@/lib/auth/requestValidation";
import { rateLimit } from "@/lib/auth/rateLimit";
import { getRequestContext } from "@/lib/http/requestContext";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildEmailHtml(code: string) {
  return `
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b12;padding:32px 0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#0f111a;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);box-shadow:0 16px 60px rgba(0,0,0,0.55);color:#f7f7f7;">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#ff00c8,#5b8bff);color:#0b0b12;font-size:22px;font-weight:800;letter-spacing:-0.3px;">
                ORYA · Código de verificação
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;color:#e5e7eb;font-size:14px;line-height:1.6;">
                <p style="margin:0 0 12px 0;">Aqui está o teu código.</p>
                <p style="margin:0 0 24px 0;">Introduz para verificar o teu email:</p>
                <div style="display:inline-block;padding:12px 18px;border-radius:12px;background:#111522;border:1px solid rgba(255,255,255,0.08);font-size:24px;font-weight:800;letter-spacing:6px;color:#fdfdfd;">
                  ${code}
                </div>
                <p style="margin:24px 0 0 0;color:#aeb7c6;font-size:13px;">Se não foste tu, ignora.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 32px;color:#7a8397;font-size:12px;background:#0c0f18;border-top:1px solid rgba(255,255,255,0.06);">
                ORYA
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOriginOrApp(req)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const ctx = getRequestContext(req);
    const body = (await req.json().catch(() => null)) as
      | { email?: string; password?: string | null; username?: string | null; fullName?: string | null }
      | null;

    const rawEmail = body?.email?.toLowerCase().trim() ?? "";
    const password = body?.password ?? null;
    const rawUsername = body?.username?.trim() ?? "";
    const rawFullName = body?.fullName ?? "";

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json(
        { ok: false, error: "Email inválido." },
        { status: 400 },
      );
    }

    const limiter = await rateLimit(req, {
      windowMs: 10 * 60 * 1000,
      max: 5,
      keyPrefix: "auth:send-otp",
      identifier: rawEmail,
    });
    if (!limiter.allowed) {
      return NextResponse.json(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } }
      );
    }

    if (password !== null && password !== undefined && password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "A password deve ter pelo menos 6 caracteres." },
        { status: 400 },
      );
    }
    let usernameNormalized: string | null = null;
    if (rawUsername) {
      const usernameValidation = normalizeAndValidateUsername(rawUsername);
      if (!usernameValidation.ok) {
        return NextResponse.json(
          { ok: false, error: usernameValidation.error, code: "USERNAME_INVALID" },
          { status: 400 },
        );
      }
      const availability = await checkUsernameAvailability(usernameValidation.username);
      if (availability.ok && availability.available === false) {
        return NextResponse.json(
          { ok: false, error: "Este @ já está a ser usado — escolhe outro.", code: "USERNAME_TAKEN" },
          { status: 409 },
        );
      }
      usernameNormalized = usernameValidation.username;
    }
    const fullName = rawFullName?.trim() || null;

    const siteUrl = getAppBaseUrl();

    // Apenas OTP de signup. Se email já existir → pedir login/Google.
    const linkPayload: Record<string, unknown> = {
      type: "signup",
      email: rawEmail,
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
        data: {
          ...(usernameNormalized ? { pending_username: usernameNormalized } : {}),
          full_name: fullName || undefined,
        },
      },
    };
    if (password) {
      linkPayload.password = password;
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink(linkPayload as any);

    if (error) {
      const errorCode =
        typeof error === "object" && error && "code" in error
          ? (error as { code?: string }).code
          : undefined;
      if (errorCode === "email_exists") {
        return NextResponse.json(
          {
            ok: false,
            error: "Este email já tem conta. Inicia sessão ou usa o Google.",
            code: "email_exists",
          },
          { status: 409 },
        );
      }
      if (errorCode === "weak_password") {
        const reasons =
          typeof error === "object" && error && "reasons" in error
            ? (error as { reasons?: string[] }).reasons
            : undefined;
        return NextResponse.json(
          {
            ok: false,
            error: "A password não foi aceite pelo sistema de autenticação.",
            code: "weak_password",
            reasons,
          },
          { status: 400 },
        );
      }
      console.error("[send-otp] generateLink error", {
        error,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      return NextResponse.json(
        {
          ok: false,
              error: "Não foi possível gerar o código. Tenta novamente dentro de alguns minutos.",
              details: typeof error === "object" ? (error as unknown as Record<string, unknown>) : undefined,
            },
            { status: 500 },
          );
    }

    const otp = data?.properties?.email_otp ?? null;
    if (!otp) {
      console.error("[send-otp] missing email_otp in response", {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      return NextResponse.json(
        { ok: false, error: "Não foi possível gerar o código. Tenta novamente." },
        { status: 500 },
      );
    }

    try {
      await resend.emails.send({
        from: env.resendFrom,
        to: rawEmail,
        subject: `Código ORYA: ${otp}`,
        html: buildEmailHtml(otp),
      });
    } catch (mailErr) {
      console.error("[send-otp] resend error", {
        mailErr,
        env: process.env.NODE_ENV,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Não foi possível enviar o código. Tenta novamente dentro de alguns minutos.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const ctx = getRequestContext(req);
    console.error("[send-otp] error:", {
      err,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
    });
    return NextResponse.json(
      { ok: false, error: "Erro inesperado ao enviar código." },
      { status: 500 },
    );
  }
}
