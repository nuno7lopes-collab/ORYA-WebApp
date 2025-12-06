

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resend } from "@/lib/resend";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email em falta." },
        { status: 400 }
      );
    }

    // Gera novo OTP de signup e envia via Resend (mesmo template do send-otp)
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      process.env.SITE_URL ??
      env.supabaseUrl;

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) {
      const errorCode =
        typeof error === "object" && error && "code" in error
          ? (error as { code?: string }).code
          : undefined;
      if (errorCode === "email_exists") {
        return NextResponse.json(
          { error: "Email já registado. Usa login ou Google.", code: "email_exists" },
          { status: 409 },
        );
      }
      console.error("[resend-otp] generateLink error:", error);
      return NextResponse.json(
        { error: "Não foi possível reenviar o código. Tenta mais tarde." },
        { status: 500 }
      );
    }

    if (!data?.properties?.email_otp) {
      console.error("[resend-otp] missing email_otp in response");
      return NextResponse.json(
        { error: "Não foi possível gerar o código. Tenta mais tarde." },
        { status: 500 },
      );
    }

    const code: string = data.properties.email_otp;

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
                  <p style="margin:0 0 12px 0;">Olá! Aqui está o teu código de 6 dígitos para continuares na ORYA.</p>
                  <p style="margin:0 0 24px 0;">Introduz este código na app para verificares o teu email:</p>
                  <div style="display:inline-block;padding:12px 18px;border-radius:12px;background:#111522;border:1px solid rgba(255,255,255,0.08);font-size:24px;font-weight:800;letter-spacing:6px;color:#fdfdfd;">
                    ${code}
                  </div>
                  <p style="margin:24px 0 0 0;color:#aeb7c6;font-size:13px;">Se não foste tu, ignora este email.</p>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 32px;color:#7a8397;font-size:12px;background:#0c0f18;border-top:1px solid rgba(255,255,255,0.06);">
                  Obrigado por confiares na ORYA.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;

    try {
      await resend.emails.send({
        from: env.resendFrom,
        to: email,
        subject: `Código ORYA: ${code}`,
        html,
      });
    } catch (mailErr) {
      console.error("[resend-otp] resend error", { mailErr, email, env: process.env.NODE_ENV });
      return NextResponse.json(
        { error: "Não foi possível reenviar o código. Tenta mais tarde." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erro em /api/auth/resend-otp:", err);
    return NextResponse.json(
      { error: "Erro interno." },
      { status: 500 }
    );
  }
}
