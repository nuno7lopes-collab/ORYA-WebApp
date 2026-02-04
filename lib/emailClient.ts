import "server-only";

import nodemailer from "nodemailer";
import { env } from "@/lib/env";

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  from?: string;
};

const parseBoolean = (raw?: string | null) => {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const resolveSmtpConfig = () => {
  const region = env.sesRegion;
  const host = process.env.SES_SMTP_HOST?.trim() || `email-smtp.${region}.amazonaws.com`;
  const portRaw = process.env.SES_SMTP_PORT?.trim();
  const port = portRaw ? Number(portRaw) : 587;
  const secure = process.env.SES_SMTP_SECURE ? parseBoolean(process.env.SES_SMTP_SECURE) : port === 465;
  return { host, port, secure };
};

const resolveFrom = () => {
  const explicit =
    env.emailFrom?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    process.env.SES_FROM_EMAIL?.trim() ||
    "";
  if (explicit) return explicit;
  return `noreply@${env.sesIdentityDomain}`;
};

let transport: nodemailer.Transporter | null = null;

const getTransport = () => {
  if (!transport) {
    const { host, port, secure } = resolveSmtpConfig();
    transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: env.sesSmtpUsername,
        pass: env.sesSmtpPassword,
      },
    });
  }
  return transport;
};

export function assertEmailReady() {
  resolveFrom();
  getTransport();
}

export async function sendEmail(params: SendEmailParams) {
  const transporter = getTransport();
  const from = params.from?.trim() || resolveFrom();
  const to = Array.isArray(params.to) ? params.to : [params.to];
  return transporter.sendMail({
    from,
    to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    replyTo: params.replyTo,
  });
}
