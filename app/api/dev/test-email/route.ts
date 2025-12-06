import { NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/resend";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Route disabled in production." }, { status: 404 });
  }

  const to = req.nextUrl.searchParams.get("to");
  if (!to) {
    return NextResponse.json({ ok: false, error: "Parâmetro 'to' em falta." }, { status: 400 });
  }

  try {
    const result = await resend.emails.send({
      from: env.resendFrom,
      to,
      subject: "Teste de email ORYA (dev)",
      html: `<p>Teste de email ORYA enviado em ${new Date().toISOString()}</p>`,
    });
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err) {
    console.error("[dev/test-email] error", err);
    return NextResponse.json(
      { ok: false, error: "Falha a enviar email de teste", details: String((err as Error)?.message || err) },
      { status: 500 },
    );
  }
}
