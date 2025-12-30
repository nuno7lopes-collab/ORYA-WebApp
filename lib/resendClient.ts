import "server-only";

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  from?: string;
};

function ensureResendConfigured() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new Error(
      "Resend não está configurado (faltam RESEND_API_KEY ou RESEND_FROM_EMAIL).",
    );
  }

  return { apiKey, from };
}

export async function sendEmail(params: SendEmailParams) {
  const { apiKey, from } = ensureResendConfigured();

  const payload = {
    from: params.from ?? from,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
    text: params.text,
    reply_to: params.replyTo,
  };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `Falha ao enviar email via Resend (status ${res.status}): ${txt || res.statusText}`,
    );
  }

  return res.json().catch(() => ({}));
}

export function assertResendReady() {
  ensureResendConfigured();
}
