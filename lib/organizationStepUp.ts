import { createHash, randomInt, randomUUID } from "crypto";
import { OrganizationStepUpAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/emailClient";

export const ORG_STEP_UP_CODE_TTL_MS = 10 * 60 * 1000;
export const ORG_STEP_UP_MAX_ATTEMPTS = 5;
export const ORG_STEP_UP_LOCKOUT_MS = 15 * 60 * 1000;
const ORG_STEP_UP_RESEND_COOLDOWN_MS = 30 * 1000;

type TxLike = Prisma.TransactionClient | typeof prisma;

export type OrganizationStepUpResult =
  | {
      ok: true;
      challengeId: string;
    }
  | {
      ok: false;
      status: number;
      errorCode: string;
      message: string;
      details?: Record<string, unknown>;
    };

function buildCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function normalizeCode(raw: unknown) {
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().replace(/\s+/g, "");
  return /^\d{6}$/.test(normalized) ? normalized : null;
}

function hashChallengeCode(challengeId: string, code: string) {
  return createHash("sha256").update(`${challengeId}:${code}`).digest("hex");
}

function actionLabel(action: OrganizationStepUpAction) {
  if (action === "ORG_SUSPEND") return "suspender a organização";
  if (action === "ORG_REACTIVATE") return "reativar a organização";
  if (action === "REFUND_EXECUTE") return "executar um reembolso";
  if (action === "REFUND_OVERRIDE") return "validar um override de reembolso";
  return "apagar a organização";
}

async function sendStepUpCodeEmail(params: {
  to: string;
  action: OrganizationStepUpAction;
  code: string;
  challengeId: string;
  expiresAt: Date;
}) {
  const { to, action, code, challengeId, expiresAt } = params;
  const expiresAtLabel = expiresAt.toLocaleString("pt-PT");
  const actionText = actionLabel(action);

  await sendEmail({
    to,
    subject: `Código ORYA para ${actionText}`,
    html: `<p>Recebemos um pedido para <strong>${actionText}</strong>.</p>
<p>O teu código de confirmação é: <strong style=\"font-size:20px;letter-spacing:2px;\">${code}</strong></p>
<p>Este código expira em 10 minutos (${expiresAtLabel}) e só pode ser usado uma vez.</p>
<p>Se não foste tu, ignora este email.</p>
<p style=\"color:#999;font-size:12px;\">Ref. desafio: ${challengeId}</p>`,
    text: [
      `Pedido para ${actionText}.`,
      `Código: ${code}`,
      `Expira: ${expiresAtLabel}`,
      `Ref: ${challengeId}`,
      "Se não foste tu, ignora este email.",
    ].join("\n"),
  });
}

async function getLatestChallenge(params: {
  organizationId: number;
  userId: string;
  action: OrganizationStepUpAction;
  client?: TxLike;
}) {
  const { organizationId, userId, action, client = prisma } = params;
  return client.organizationStepUpChallenge.findFirst({
    where: {
      organizationId,
      userId,
      action,
      consumedAt: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export async function requireOrganizationStepUp(params: {
  organizationId: number;
  userId: string;
  userEmail?: string | null;
  action: OrganizationStepUpAction;
  challengeId?: unknown;
  code?: unknown;
  client?: TxLike;
}): Promise<OrganizationStepUpResult> {
  const {
    organizationId,
    userId,
    userEmail,
    action,
    challengeId: challengeIdRaw,
    code: codeRaw,
    client = prisma,
  } = params;

  const now = new Date();
  const normalizedCode = normalizeCode(codeRaw);
  const challengeId = typeof challengeIdRaw === "string" ? challengeIdRaw.trim() : "";

  if (challengeId && normalizedCode) {
    const challenge = await client.organizationStepUpChallenge.findFirst({
      where: {
        id: challengeId,
        organizationId,
        userId,
        action,
      },
      select: {
        id: true,
        codeHash: true,
        expiresAt: true,
        consumedAt: true,
        attemptCount: true,
        lockoutUntil: true,
      },
    });

    if (!challenge || challenge.consumedAt) {
      return {
        ok: false,
        status: 403,
        errorCode: "STEP_UP_REQUIRED",
        message: "Confirmação adicional obrigatória.",
      };
    }

    if (challenge.lockoutUntil && challenge.lockoutUntil.getTime() > now.getTime()) {
      return {
        ok: false,
        status: 429,
        errorCode: "STEP_UP_LOCKED",
        message: "Código temporariamente bloqueado por tentativas inválidas.",
        details: { retryAt: challenge.lockoutUntil.toISOString() },
      };
    }

    if (challenge.expiresAt.getTime() <= now.getTime()) {
      return {
        ok: false,
        status: 409,
        errorCode: "STEP_UP_EXPIRED",
        message: "Código expirado. Pede um novo código.",
      };
    }

    const expectedHash = hashChallengeCode(challenge.id, normalizedCode);
    if (expectedHash !== challenge.codeHash) {
      const nextAttempts = challenge.attemptCount + 1;
      const lockoutUntil =
        nextAttempts >= ORG_STEP_UP_MAX_ATTEMPTS ? new Date(now.getTime() + ORG_STEP_UP_LOCKOUT_MS) : null;

      await client.organizationStepUpChallenge.update({
        where: { id: challenge.id },
        data: {
          attemptCount: nextAttempts,
          lockoutUntil,
        },
      });

      return {
        ok: false,
        status: lockoutUntil ? 429 : 403,
        errorCode: lockoutUntil ? "STEP_UP_LOCKED" : "STEP_UP_INVALID_CODE",
        message: lockoutUntil
          ? "Código temporariamente bloqueado por tentativas inválidas."
          : "Código inválido.",
        details: {
          attemptsRemaining: Math.max(0, ORG_STEP_UP_MAX_ATTEMPTS - nextAttempts),
          maxAttempts: ORG_STEP_UP_MAX_ATTEMPTS,
          ...(lockoutUntil ? { retryAt: lockoutUntil.toISOString() } : {}),
        },
      };
    }

    await client.organizationStepUpChallenge.update({
      where: { id: challenge.id },
      data: {
        consumedAt: now,
        attemptCount: 0,
        lockoutUntil: null,
      },
    });

    return { ok: true, challengeId: challenge.id };
  }

  if (!userEmail || !userEmail.includes("@")) {
    return {
      ok: false,
      status: 403,
      errorCode: "STEP_UP_EMAIL_REQUIRED",
      message: "Conta sem email válido para confirmar esta ação.",
    };
  }

  const current = await getLatestChallenge({ organizationId, userId, action, client });
  if (current?.lockoutUntil && current.lockoutUntil.getTime() > now.getTime()) {
    return {
      ok: false,
      status: 429,
      errorCode: "STEP_UP_LOCKED",
      message: "Código temporariamente bloqueado por tentativas inválidas.",
      details: { retryAt: current.lockoutUntil.toISOString() },
    };
  }

  if (current?.lastSentAt && now.getTime() - current.lastSentAt.getTime() < ORG_STEP_UP_RESEND_COOLDOWN_MS) {
    const retryAt = new Date(current.lastSentAt.getTime() + ORG_STEP_UP_RESEND_COOLDOWN_MS);
    return {
      ok: false,
      status: 429,
      errorCode: "STEP_UP_RESEND_THROTTLED",
      message: "Aguarda alguns segundos antes de pedir novo código.",
      details: { retryAt: retryAt.toISOString() },
    };
  }

  const targetChallengeId =
    current && current.expiresAt.getTime() > now.getTime() ? current.id : randomUUID();
  const code = buildCode();
  const expiresAt = new Date(now.getTime() + ORG_STEP_UP_CODE_TTL_MS);

  if (current && current.id === targetChallengeId) {
    await client.organizationStepUpChallenge.update({
      where: { id: targetChallengeId },
      data: {
        codeHash: hashChallengeCode(targetChallengeId, code),
        expiresAt,
        consumedAt: null,
        lastSentAt: now,
      },
    });
  } else {
    await client.organizationStepUpChallenge.create({
      data: {
        id: targetChallengeId,
        organizationId,
        userId,
        action,
        codeHash: hashChallengeCode(targetChallengeId, code),
        expiresAt,
        attemptCount: 0,
        lockoutUntil: null,
        consumedAt: null,
        lastSentAt: now,
        metadata: {},
      },
    });
  }

  try {
    await sendStepUpCodeEmail({
      to: userEmail,
      action,
      code,
      challengeId: targetChallengeId,
      expiresAt,
    });
  } catch (err) {
    console.error("[organization-step-up] failed to send email", err);
    return {
      ok: false,
      status: 500,
      errorCode: "STEP_UP_DELIVERY_FAILED",
      message: "Não foi possível enviar o código de confirmação.",
    };
  }

  return {
    ok: false,
    status: 403,
    errorCode: "STEP_UP_REQUIRED",
    message: "Confirmação adicional obrigatória. Enviámos um código por email.",
    details: {
      challengeId: targetChallengeId,
      expiresAt: expiresAt.toISOString(),
      maxAttempts: ORG_STEP_UP_MAX_ATTEMPTS,
      ttlSeconds: Math.floor(ORG_STEP_UP_CODE_TTL_MS / 1000),
      channel: "email_code",
    },
  };
}
