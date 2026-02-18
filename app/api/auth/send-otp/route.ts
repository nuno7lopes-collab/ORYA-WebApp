import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/emailClient";
import { getAppBaseUrl } from "@/lib/appBaseUrl";
import { normalizeAndValidateUsername, checkUsernameAvailability } from "@/lib/globalUsernames";
import { isAppRequest, isSameOrigin } from "@/lib/auth/requestValidation";
import { isRateLimitBackendUnavailableError, rateLimit } from "@/lib/auth/rateLimit";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildEmailHtml(code: string, actionLink?: string | null) {
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
                ${
                  actionLink
                    ? `<p style="margin:20px 0 0 0;color:#cdd5e6;font-size:13px;">Se preferires, também podes confirmar diretamente aqui:</p>
                <p style="margin:10px 0 0 0;"><a href="${actionLink}" style="color:#8fd6ff;text-decoration:underline;">Abrir link de confirmação</a></p>`
                    : ""
                }
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

function buildEmailText(code: string, actionLink?: string | null) {
  return [
    "Aqui está o teu código de verificação ORYA:",
    code,
    actionLink ? `Ou confirma diretamente neste link: ${actionLink}` : null,
    "Se não foste tu, ignora este email.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildMagicLinkEmailHtml(actionLink: string) {
  return `
    <table width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b12;padding:32px 0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#0f111a;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);box-shadow:0 16px 60px rgba(0,0,0,0.55);color:#f7f7f7;">
            <tr>
              <td style="padding:28px 32px;background:linear-gradient(135deg,#ff00c8,#5b8bff);color:#0b0b12;font-size:22px;font-weight:800;letter-spacing:-0.3px;">
                ORYA · Confirmar acesso
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px;color:#e5e7eb;font-size:14px;line-height:1.6;">
                <p style="margin:0 0 12px 0;">Para continuar, abre o link seguro:</p>
                <p style="margin:0 0 24px 0;">
                  <a href="${actionLink}" style="color:#8fd6ff;text-decoration:underline;">Confirmar acesso ORYA</a>
                </p>
                <p style="margin:0;color:#aeb7c6;font-size:13px;">Se não foste tu, ignora este email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function buildMagicLinkEmailText(actionLink: string) {
  return `Para continuar na ORYA, abre este link seguro: ${actionLink}\n\nSe não foste tu, ignora este email.`;
}

function isMobileClientRequest(req: NextRequest) {
  const platform =
    req.headers.get("x-client-platform") ||
    req.headers.get("x-app-platform") ||
    req.headers.get("x-platform");
  const normalized = platform?.trim().toLowerCase() ?? "";
  return normalized === "mobile" || normalized === "ios" || normalized === "android";
}

async function _POST(req: NextRequest) {
  try {
    const isMobileClient = isMobileClientRequest(req);
    if (!isAppRequest(req) && !isSameOrigin(req, { allowMissing: isMobileClient })) {
      return jsonWrap(
        { ok: false, errorCode: "FORBIDDEN", message: "Pedido não autorizado." },
        { status: 403 }
      );
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
      return jsonWrap(
        { ok: false, errorCode: "INVALID_EMAIL", message: "Email inválido." },
        { status: 400 },
      );
    }

    let ipLimiter;
    try {
      ipLimiter = await rateLimit(req, {
        windowMs: 10 * 60 * 1000,
        max: 20,
        keyPrefix: "auth:send-otp:ip",
        requireDistributed: true,
      });
    } catch (err) {
      if (isRateLimitBackendUnavailableError(err)) {
        return jsonWrap(
          {
            ok: false,
            errorCode: err.code,
            message: "Serviço de proteção temporariamente indisponível.",
            retryable: true,
          },
          { status: 503 }
        );
      }
      throw err;
    }
    if (!ipLimiter.allowed) {
      return jsonWrap(
        {
          ok: false,
          errorCode: "RATE_LIMITED",
          message: "Muitas tentativas. Tenta novamente dentro de alguns minutos.",
          retryable: true,
        },
        { status: 429, headers: { "Retry-After": String(ipLimiter.retryAfter) } }
      );
    }

    let limiter;
    try {
      limiter = await rateLimit(req, {
        windowMs: 10 * 60 * 1000,
        max: 5,
        keyPrefix: "auth:send-otp",
        identifier: rawEmail,
        requireDistributed: true,
      });
    } catch (err) {
      if (isRateLimitBackendUnavailableError(err)) {
        return jsonWrap(
          {
            ok: false,
            errorCode: err.code,
            message: "Serviço de proteção temporariamente indisponível.",
            retryable: true,
          },
          { status: 503 }
        );
      }
      throw err;
    }
    if (!limiter.allowed) {
      return jsonWrap(
        {
          ok: false,
          errorCode: "RATE_LIMITED",
          message: "Muitas tentativas. Tenta novamente dentro de alguns minutos.",
          retryable: true,
        },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } }
      );
    }

    if (password !== null && password !== undefined && password.length < 6) {
      return jsonWrap(
        {
          ok: false,
          errorCode: "WEAK_PASSWORD",
          message: "A password deve ter pelo menos 6 caracteres.",
        },
        { status: 400 },
      );
    }
    let usernameNormalized: string | null = null;
    if (rawUsername) {
      const usernameValidation = normalizeAndValidateUsername(rawUsername, {
        allowReservedForEmail: rawEmail ?? null,
      });
      if (!usernameValidation.ok) {
        return jsonWrap(
          {
            ok: false,
            errorCode: usernameValidation.code ?? "USERNAME_INVALID",
            message: usernameValidation.error,
          },
          { status: 400 },
        );
      }
      const availability = await checkUsernameAvailability(usernameValidation.username, undefined, {
        allowReservedForEmail: rawEmail ?? null,
      });
      if (availability.ok && availability.available === false) {
        return jsonWrap(
          {
            ok: false,
            errorCode: "USERNAME_TAKEN",
            message: "Este @ já está a ser usado — escolhe outro.",
          },
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

    let otp: string | null = null;
    let actionLink: string | null = null;
    const { data, error } = await supabaseAdmin.auth.admin.generateLink(linkPayload as any);

    if (error) {
      const errorCode =
        typeof error === "object" && error && "code" in error
          ? (error as { code?: string }).code
          : undefined;
      if (errorCode === "email_exists") {
        // Não expor enumeração: gerar magic link OTP e responder genericamente.
        const loginRes = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: rawEmail,
          options: { redirectTo: `${siteUrl}/auth/callback` },
        });
        if (loginRes.error) {
          console.error("[send-otp] generateLink magiclink error", {
            error: loginRes.error,
            requestId: ctx.requestId,
            correlationId: ctx.correlationId,
          });
          return jsonWrap(
            {
              ok: false,
              errorCode: "OTP_GENERATION_FAILED",
              message: "Não foi possível gerar o código. Tenta novamente dentro de alguns minutos.",
            },
            { status: 500 },
          );
        }
        otp = loginRes.data?.properties?.email_otp ?? null;
        actionLink = loginRes.data?.properties?.action_link ?? null;
      } else if (errorCode === "weak_password") {
        const reasons =
          typeof error === "object" && error && "reasons" in error
            ? (error as { reasons?: string[] }).reasons
            : undefined;
        return jsonWrap(
          {
            ok: false,
            errorCode: "WEAK_PASSWORD",
            message: "A password não foi aceite pelo sistema de autenticação.",
            reasons,
          },
          { status: 400 },
        );
      } else {
        console.error("[send-otp] generateLink error", {
          error,
          requestId: ctx.requestId,
          correlationId: ctx.correlationId,
        });
        return jsonWrap(
          {
            ok: false,
            errorCode: "OTP_GENERATION_FAILED",
            message: "Não foi possível gerar o código. Tenta novamente dentro de alguns minutos.",
          },
          { status: 500 },
        );
      }
    } else {
      otp = data?.properties?.email_otp ?? null;
      actionLink = data?.properties?.action_link ?? null;
    }

    if (!otp && !actionLink) {
      console.error("[send-otp] missing email_otp in response", {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      return jsonWrap(
        {
          ok: false,
          errorCode: "OTP_GENERATION_FAILED",
          message: "Não foi possível gerar o código. Tenta novamente.",
        },
        { status: 500 },
      );
    }

    try {
      const message = otp
        ? {
            subject: "Código de verificação ORYA",
            html: buildEmailHtml(otp, actionLink),
            text: buildEmailText(otp, actionLink),
          }
        : {
            subject: "Confirma o teu acesso ORYA",
            html: buildMagicLinkEmailHtml(actionLink as string),
            text: buildMagicLinkEmailText(actionLink as string),
          };
      const sendResult = await sendEmail({
        to: rawEmail,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      console.info("[send-otp] email sent", {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        mode: otp ? "otp" : "magiclink",
        messageId:
          sendResult && typeof sendResult === "object" && "messageId" in sendResult
            ? (sendResult as { messageId?: string }).messageId ?? null
            : null,
      });
    } catch (mailErr) {
      console.error("[send-otp] email send error", {
        mailErr,
        env: process.env.NODE_ENV,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
      });
      return jsonWrap(
        {
          ok: false,
          errorCode: "EMAIL_SEND_FAILED",
          message: "Não foi possível enviar o código. Tenta novamente dentro de alguns minutos.",
        },
        { status: 502 },
      );
    }

    // Mantém resposta opaca para evitar enumeração de contas.
    return jsonWrap({ ok: true, otpType: "signup" });
  } catch (err) {
    const ctx = getRequestContext(req);
    console.error("[send-otp] error:", {
      err,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
    });
    return jsonWrap(
      { ok: false, errorCode: "INTERNAL_ERROR", message: "Erro inesperado ao enviar código." },
      { status: 500 },
    );
  }
}
export const POST = withApiEnvelope(_POST);
