import { markOutboxFailed, markOutboxSent } from "@/domain/notifications/outbox";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resendClient";

const BATCH_SIZE = 25;

export async function POST() {
  const pending = await prisma.notificationOutbox.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  let sent = 0;
  for (const item of pending) {
    try {
      // Se não tiver userId, não conseguimos enviar email; marcar failed.
      if (!item.userId) {
        await markOutboxFailed(item.id, "missing userId");
        continue;
      }

      const email = await fetchUserEmail(item.userId);
      if (!email) {
        await markOutboxFailed(item.id, "missing user email");
        continue;
      }

      const { subject, text, pushToken } = renderMinimalTemplate(
        item.notificationType,
        item.payload as Record<string, unknown>,
      );

      // Push (simulado): se existir pushToken no payload, consideramos entregue também
      if (pushToken) {
        await sendPush(pushToken, subject, text);
      }

      await sendEmail({ to: email, subject, text, html: undefined });
      await markOutboxSent(item.id);
      sent += 1;
    } catch (err: any) {
      await markOutboxFailed(item.id, err?.message ?? "unknown");
    }
  }

  return NextResponse.json({ ok: true, processed: pending.length, sent });
}

async function fetchUserEmail(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) return null;
    return data.user?.email ?? null;
  } catch {
    return null;
  }
}

function renderMinimalTemplate(type: string, payload: Record<string, unknown>) {
  switch (type) {
    case "PAIRING_INVITE":
      return {
        subject: "Convite para torneio Padel",
        text: `Recebeste um convite para emparelhar. Pairing: ${payload.pairingId ?? ""}`,
      };
    case "PARTNER_PAID":
      return { subject: "Parceiro pagou", text: "O teu parceiro concluiu o pagamento." };
    case "DEADLINE_EXPIRED":
      return { subject: "Prazo expirado", text: "O prazo do pairing expirou ou falhou." };
    case "OFFSESSION_ACTION_REQUIRED":
      return { subject: "Confirmação necessária", text: "Falta concluir a autenticação do pagamento." };
    case "MATCH_CHANGED":
      return {
        subject: "Jogo atualizado",
        text: `Horário/court atualizado. Match ${payload.matchId ?? ""} começa em ${payload.startAt ?? "a definir"}.`,
      };
    case "MATCH_RESULT":
      return { subject: "Resultado disponível", text: `Resultado registado para o jogo ${payload.matchId ?? ""}.` };
    case "NEXT_OPPONENT":
      return { subject: "Próximo adversário", text: "O teu próximo adversário está definido." };
    case "BRACKET_PUBLISHED":
      return { subject: "Chave do torneio publicada", text: "Consulta a estrutura atualizada do torneio." };
    case "TOURNAMENT_EVE_REMINDER":
      return { subject: "Torneio é amanhã", text: "O torneio arranca em breve. Confirma o teu horário." };
    case "ELIMINATED":
      return { subject: "Eliminado", text: "Foste eliminado do torneio." };
    case "CHAMPION":
      return { subject: "Parabéns, campeão!", text: "Ganhaste o torneio." };
    case "BROADCAST":
      return { subject: "Aviso do organizador", text: payload?.message?.toString() || "Tens um aviso novo." };
    case "NEW_FOLLOWER":
      return { subject: "Novo seguidor", text: "Tens um novo seguidor na plataforma." };
    case "PAIRING_REQUEST_RECEIVED":
      return { subject: "Pedido de emparelhamento", text: "Recebeste um pedido de emparelhamento." };
    case "PAIRING_REQUEST_ACCEPTED":
      return { subject: "Pedido aceite", text: "O teu pedido de emparelhamento foi aceite." };
    case "TICKET_WAITING_CLAIM":
      return { subject: "Bilhete à tua espera", text: "Tens um bilhete à espera de claim." };
    default:
      return { subject: "Notificação ORYA", text: "Tens uma atualização." };
  }
}

async function sendPush(pushToken: string, title: string, body: string) {
  // Stub de push: integra com o provider real se disponível.
  console.log("[notifications][push] envio simulado", { pushToken, title, body });
}
