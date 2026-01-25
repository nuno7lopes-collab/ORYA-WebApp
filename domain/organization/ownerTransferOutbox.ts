import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendOwnerTransferEmail } from "@/lib/emailSender";
import { sendEmail } from "@/lib/resendClient";
import { getAppBaseUrl } from "@/lib/appBaseUrl";

type OwnerTransferOutboxPayload = {
  transferId: string;
  organizationId: number;
  fromUserId: string;
  toUserId: string;
};

const buildDedupeKey = (transferId: string, eventType: string) => `${transferId}:${eventType}`;

async function ensureEmailDedupe(dedupeKey: string, recipient: string) {
  const existing = await prisma.emailOutbox.findUnique({ where: { dedupeKey } });
  if (existing) return false;
  await prisma.emailOutbox.create({
    data: {
      templateKey: "OWNER_TRANSFER",
      recipient,
      purchaseId: dedupeKey,
      dedupeKey,
      status: "PENDING",
      payload: {},
    },
  });
  return true;
}

export async function handleOwnerTransferOutboxEvent(params: {
  eventType: string;
  payload: OwnerTransferOutboxPayload;
}) {
  const { eventType, payload } = params;
  if (!payload?.transferId) throw new Error("OWNER_TRANSFER_OUTBOX_MISSING_ID");

  if (eventType === "organization.owner_transfer.requested") {
    const transfer = await prisma.organizationOwnerTransfer.findUnique({
      where: { id: payload.transferId },
      include: { organization: { select: { publicName: true, username: true } } },
    });
    if (!transfer) return { ok: false, code: "TRANSFER_NOT_FOUND" } as const;

    const targetUser = await supabaseAdmin.auth.admin.getUserById(payload.toUserId);
    const targetEmail = targetUser.data?.user?.email ?? null;
    if (!targetEmail) return { ok: false, code: "TARGET_EMAIL_MISSING" } as const;

    const dedupeKey = buildDedupeKey(payload.transferId, eventType);
    const shouldSend = await ensureEmailDedupe(dedupeKey, targetEmail);
    if (!shouldSend) return { ok: true, deduped: true } as const;

    const actorName = "OWNER atual";
    const organizationName =
      transfer.organization?.publicName || transfer.organization?.username || "Organização ORYA";
    await sendOwnerTransferEmail({
      to: targetEmail,
      organizationName,
      actorName,
      token: transfer.token,
      expiresAt: transfer.expiresAt,
    });
    await prisma.emailOutbox.update({
      where: { dedupeKey },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { ok: true } as const;
  }

  if (eventType === "organization.owner_transfer.confirmed") {
    const transfer = await prisma.organizationOwnerTransfer.findUnique({
      where: { id: payload.transferId },
      include: { organization: { select: { publicName: true, username: true } } },
    });
    if (!transfer) return { ok: false, code: "TRANSFER_NOT_FOUND" } as const;

    const fromUser = await supabaseAdmin.auth.admin.getUserById(payload.fromUserId);
    const fromEmail = fromUser.data?.user?.email ?? null;
    if (!fromEmail) return { ok: false, code: "FROM_EMAIL_MISSING" } as const;

    const dedupeKey = buildDedupeKey(payload.transferId, eventType);
    const shouldSend = await ensureEmailDedupe(dedupeKey, fromEmail);
    if (!shouldSend) return { ok: true, deduped: true } as const;

    const organizationName =
      transfer.organization?.publicName || transfer.organization?.username || "Organização ORYA";
    const baseUrl = getAppBaseUrl();
    await sendEmail({
      to: fromEmail,
      subject: `✅ Transferência concluída – ${organizationName}`,
      html: `<div style=\"font-family: Arial, sans-serif; color:#0f172a;\">\n            <h2>Transferência de OWNER concluída</h2>\n            <p>O papel de OWNER em <strong>${organizationName}</strong> foi assumido por um novo OWNER.</p>\n            <p>Podes rever o staff aqui: <a href=\"${baseUrl}/organizacao?tab=manage&section=staff\" style=\"color:#2563eb;\">Ver staff</a></p>\n          </div>`,
      text: `Transferência de OWNER concluída\n${organizationName}\nStaff: ${baseUrl}/organizacao?tab=manage&section=staff`,
    });
    await prisma.emailOutbox.update({
      where: { dedupeKey },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { ok: true } as const;
  }

  return { ok: true } as const;
}
