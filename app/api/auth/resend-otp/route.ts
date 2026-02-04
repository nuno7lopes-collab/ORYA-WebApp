import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/emailClient";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { isSameOriginOrApp } from "@/lib/auth/requestValidation";
import { rateLimit } from "@/lib/auth/rateLimit";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(req: NextRequest) {
  try {
    if (!isSameOriginOrApp(req)) {
      return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
    }

    const ctx = getRequestContext(req);
    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const email = (body?.email ?? "").trim().toLowerCase();

    if (!email) {
      return jsonWrap(
        { error: "Email em falta." },
        { status: 400 }
      );
    }

    // Gera novo OTP de signup e envia via SES SMTP (mesmo template do send-otp)
    const limiter = await rateLimit(req, {
      windowMs: 10 * 60 * 1000,
      max: 5,
      keyPrefix: "auth:resend-otp",
      identifier: String(email),
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } }
      );
    }

    const siteUrl = getAppBaseUrl();

    let otpType: "signup" | "magiclink" = "signup";

    let link = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      password: undefined,
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    } as any);

    if (link.error) {
      const errorCode =
        typeof link.error === "object" && link.error && "code" in link.error
          ? (link.error as { code?: string }).code
          : undefined;

      // O utilizador pode já existir (ex: signup iniciado/pendente ou email não confirmado).
      // Para esses casos, usamos magiclink para gerar OTP e concluir confirmação/sign-in.
      if (errorCode === "email_exists") {
        otpType = "magiclink";
        link = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email,
          options: {
            redirectTo: `${siteUrl}/auth/callback`,
          },
        } as any);
      }
    }

    if (link.error) {
      console.error("[resend-otp] generateLink error", {
        error: link.error,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      return jsonWrap(
        { error: "Não foi possível reenviar o código. Tenta mais tarde." },
        { status: 500 }
      );
    }

    if (!link.data?.properties?.email_otp) {
      console.error("[resend-otp] missing email_otp in response", {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      return jsonWrap(
        { error: "Não foi possível gerar o código. Tenta mais tarde." },
        { status: 500 },
      );
    }

    const code: string = link.data.properties.email_otp;

    const html = `
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

    try {
      await sendEmail({
        to: email,
        subject: `Código ORYA: ${code}`,
        html,
      });
    } catch (mailErr) {
      console.error("[resend-otp] email send error", {
        mailErr,
        env: process.env.NODE_ENV,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      return jsonWrap(
        { error: "Não foi possível reenviar o código. Tenta mais tarde." },
        { status: 502 },
      );
    }

    return jsonWrap({ ok: true, success: true, otpType });
  } catch (err) {
    const ctx = getRequestContext(req);
    console.error("Erro em /api/auth/resend-otp:", {
      err,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
    });
    return jsonWrap(
      { error: "Erro interno." },
      { status: 500 }
    );
  }
}
export const POST = withApiEnvelope(_POST);
