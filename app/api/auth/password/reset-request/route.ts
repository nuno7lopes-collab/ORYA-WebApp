import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/emailClient";
import { env } from "@/lib/env";
import { isSameOriginOrApp } from "@/lib/auth/requestValidation";
import { rateLimit } from "@/lib/auth/rateLimit";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildEmailHtml(link: string) {
  return `
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#050915;padding:32px 0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0b1226,#0c0f1f);border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);box-shadow:0 24px 80px rgba(0,0,0,0.55);color:#f7f7f7;">
            <tr>
              <td style="padding:26px 30px;background:linear-gradient(120deg,#ff8de1,#7cf2ff,#7b7bff);color:#0b0b12;font-size:22px;font-weight:800;letter-spacing:-0.3px;">
                ORYA · Redefinir palavra-passe
              </td>
            </tr>
            <tr>
              <td style="padding:28px 30px;color:#e5e7eb;font-size:14px;line-height:1.65;">
                <p style="margin:0 0 14px 0;">Pedido de redefinição de password.</p>
                <p style="margin:0 0 22px 0;">Clica para escolher nova.</p>
                <div style="text-align:center;margin:22px 0;">
                  <a href="${link}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:linear-gradient(90deg,#7cf2ff,#7b7bff,#ff7ddb);color:#0b0f1c;text-decoration:none;font-weight:800;letter-spacing:0.2px;">Nova password</a>
                </div>
                <p style="margin:0 0 18px 0;color:#aeb7c6;font-size:13px;">Se não foste tu, ignora.</p>
                <p style="margin:0;color:#7f8aa3;font-size:12px;">Link direto: <a href="${link}" style="color:#8fd6ff;">${link}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px;color:#7a8397;font-size:12px;background:#0c0f18;border-top:1px solid rgba(255,255,255,0.06);">
                ORYA
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

async function _POST(req: NextRequest) {
  try {
    if (!isSameOriginOrApp(req)) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const ctx = getRequestContext(req);
    const body = (await req.json().catch(() => null)) as { email?: string } | null;
    const rawEmail = body?.email?.toLowerCase().trim() ?? "";

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return jsonWrap({ ok: false, error: "Email inválido." }, { status: 400 });
    }

    const limiter = await rateLimit(req, {
      windowMs: 10 * 60 * 1000,
      max: 5,
      keyPrefix: "auth:reset-password",
      identifier: rawEmail,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } }
      );
    }

    const originRaw =
      env.appBaseUrl?.trim() ||
      req.headers.get("origin") ||
      req.nextUrl.origin ||
      "https://orya.pt";
    const origin = originRaw.replace(/\/+$/, "");
    const redirectTo = `${origin}/reset-password?recovery=1`;

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: rawEmail,
      options: { redirectTo },
    });

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "user_not_found") {
        // Não revelar existência de contas
        return jsonWrap({ ok: true });
      }
      console.error("[password/reset-request] generateLink error", {
        error,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      return jsonWrap(
        { ok: false, error: "Não foi possível gerar o link de recuperação. Tenta mais tarde." },
        { status: 500 },
      );
    }

    const baseActionLink = data?.properties?.action_link;
    if (!baseActionLink) {
      console.error("[password/reset-request] missing action_link", {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      return jsonWrap(
        { ok: false, error: "Não foi possível gerar o link de recuperação. Tenta mais tarde." },
        { status: 500 },
      );
    }

    // Garante redirect direto para /reset-password (alguns providers removem o path)
    let actionLink = baseActionLink;
    try {
      const url = new URL(baseActionLink);
      url.searchParams.set("redirect_to", redirectTo);
      actionLink = url.toString();
    } catch (e) {
    console.warn("[password/reset-request] action_link parse failed, fallback ao original", {
      error: e,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
    });
    }

    try {
      await sendEmail({
        to: rawEmail,
        subject: "Redefinir password · ORYA",
        html: buildEmailHtml(actionLink),
        text: `Recebemos um pedido de redefinição de password. Abre o link para escolher nova password: ${actionLink}`,
      });
    } catch (mailErr) {
      console.error("[password/reset-request] email send error", {
        mailErr,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      return jsonWrap(
        { ok: false, error: "Não conseguimos enviar o email agora. Tenta novamente em breve." },
        { status: 502 },
      );
    }

    return jsonWrap({ ok: true });
  } catch (err) {
    const ctx = getRequestContext(req);
    console.error("[password/reset-request] error:", {
      err,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
    });
    return jsonWrap(
      { ok: false, error: "Erro inesperado ao pedir recuperação." },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
