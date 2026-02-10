export const dynamic = "force-dynamic";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { buildDefaultCheckinWindow } from "@/lib/checkin/policy";
import { resolveActions } from "@/lib/entitlements/accessResolver";
import { isGuestTicketAccessTokenExpired } from "@/lib/guestTickets/accessTokens";
import GuestTicketClient from "./GuestTicketClient";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export default async function GuestTicketPage({ params }: { params: { token: string } }) {
  const rawToken = typeof params.token === "string" ? params.token.trim() : "";
  if (!rawToken) {
    return (
      <div className="min-h-screen bg-[#0b0f18] text-white flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80">
          Link inválido.
        </div>
      </div>
    );
  }

  const tokenHash = hashToken(rawToken);
  const access = await prisma.guestTicketAccessToken.findUnique({
    where: { tokenHash },
    select: { purchaseId: true, eventId: true, expiresAt: true },
  });

  if (!access) {
    return (
      <div className="min-h-screen bg-[#0b0f18] text-white flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80">
          Este link de bilhete já não está disponível.
        </div>
      </div>
    );
  }

  const now = new Date();
  if (isGuestTicketAccessTokenExpired(access.expiresAt ?? null, now)) {
    return (
      <div className="min-h-screen bg-[#0b0f18] text-white flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80">
          Este link expirou. Contacta o suporte se precisares de ajuda.
        </div>
      </div>
    );
  }

  const event = await prisma.event.findUnique({
    where: { id: access.eventId },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      addressRef: { select: { formattedAddress: true } },
    },
  });

  if (!event) {
    return (
      <div className="min-h-screen bg-[#0b0f18] text-white flex items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80">
          Evento não encontrado.
        </div>
      </div>
    );
  }

  const entitlements = await prisma.entitlement.findMany({
    where: {
      purchaseId: access.purchaseId,
      eventId: access.eventId,
    },
    select: {
      id: true,
      type: true,
      status: true,
      snapshotTitle: true,
      checkins: { select: { resultCode: true, checkedInAt: true } },
    },
  });

  const checkinWindow = buildDefaultCheckinWindow(event.startsAt ?? null, event.endsAt ?? null);

  const items = await Promise.all(
    entitlements.map(async (ent) => {
      const actions = resolveActions({
        type: ent.type,
        status: ent.status,
        isOwner: true,
        isOrganization: false,
        isAdmin: false,
        checkins: ent.checkins,
        checkinWindow,
        outsideWindow: false,
        emailVerified: false,
        isGuestOwner: true,
      });

      let qrToken: string | null = null;
      let info: string | null = null;
      if (actions.canShowQr) {
        await prisma.entitlementQrToken.deleteMany({ where: { entitlementId: ent.id } });
        const token = crypto.randomUUID();
        const tokenHash = hashToken(token);
        const expiresAt = checkinWindow.end ?? new Date(now.getTime() + 60 * 60 * 1000);
        await prisma.entitlementQrToken.create({
          data: {
            tokenHash,
            entitlementId: ent.id,
            expiresAt,
          },
        });
        qrToken = token;
      } else if (ent.checkins?.length) {
        info = "Bilhete já utilizado.";
      } else if (checkinWindow.end && now > checkinWindow.end) {
        info = "Fora da janela de check-in.";
      } else {
        info = "QR indisponível neste momento.";
      }

      return {
        entitlementId: ent.id,
        title: ent.snapshotTitle ?? null,
        qrToken,
        status: ent.status,
        consumedAt: ent.checkins?.[0]?.checkedInAt?.toISOString() ?? null,
        info,
      };
    }),
  );

  return (
    <GuestTicketClient
      event={{
        title: event.title,
        startsAt: event.startsAt?.toISOString() ?? null,
        endsAt: event.endsAt?.toISOString() ?? null,
        location: event.addressRef?.formattedAddress ?? null,
      }}
      purchaseId={access.purchaseId}
      items={items}
    />
  );
}
