// app/api/organizador/events/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, assertOrganizer } from "@/lib/security";
import { TicketTypeStatus, Prisma, EventTemplateType } from "@prisma/client";

type TicketTypeUpdate = {
  id: number;
  status?: TicketTypeStatus;
};

type NewTicketType = {
  name: string;
  description?: string | null;
  price: number; // cents
  totalQuantity?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

type UpdateEventBody = {
  eventId?: number;
  title?: string | null;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  locationName?: string | null;
  locationCity?: string | null;
  address?: string | null;
  templateType?: string | null;
  isFree?: boolean;
  coverImageUrl?: string | null;
  ticketTypeUpdates?: TicketTypeUpdate[];
  newTicketTypes?: NewTicketType[];
  payoutMode?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    let body: UpdateEventBody | null = null;
    try {
      body = (await req.json()) as UpdateEventBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
    }

    const eventId = Number(body?.eventId);
    if (!eventId || Number.isNaN(eventId)) {
      return NextResponse.json({ ok: false, error: "eventId é obrigatório." }, { status: 400 });
    }

    // Autorização: perfil + organizer ativo
    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado. Completa o onboarding." },
        { status: 400 },
      );
    }
    assertOrganizer(user, profile);

    const organizer = await prisma.organizer.findFirst({
      where: { userId: profile.id, status: "ACTIVE" },
    });

    if (!organizer) {
      return NextResponse.json(
        { ok: false, error: "Não tens uma conta de organizador ativa." },
        { status: 403 },
      );
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId: organizer.id },
      include: { ticketTypes: true },
    });

    if (!event) {
      return NextResponse.json({ ok: false, error: "Evento não encontrado." }, { status: 404 });
    }

    const isAdmin = Array.isArray(profile.roles) ? profile.roles.includes("admin") : false;

    const paymentsStatus = organizer
      ? organizer.stripeAccountId
        ? organizer.stripeChargesEnabled && organizer.stripePayoutsEnabled
          ? "READY"
          : "PENDING"
        : "NO_STRIPE"
      : "NO_STRIPE";

    const dataUpdate: Partial<Prisma.EventUncheckedUpdateInput> = {};
    if (body.title !== undefined) dataUpdate.title = body.title?.trim() ?? "";
    if (body.description !== undefined) dataUpdate.description = body.description ?? "";
    if (body.startsAt) {
      const d = new Date(body.startsAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ ok: false, error: "startsAt inválido." }, { status: 400 });
      }
      dataUpdate.startsAt = d;
    }
    if (body.endsAt) {
      const d = new Date(body.endsAt);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ ok: false, error: "endsAt inválido." }, { status: 400 });
      }
      dataUpdate.endsAt = d;
    }
    if (body.locationName !== undefined) dataUpdate.locationName = body.locationName ?? "";
    if (body.locationCity !== undefined) dataUpdate.locationCity = body.locationCity ?? "";
    if (body.address !== undefined) dataUpdate.address = body.address ?? null;
    if (body.templateType) {
      const tpl = body.templateType.toUpperCase();
      if ((Object.values(EventTemplateType) as string[]).includes(tpl)) {
        dataUpdate.templateType = tpl as EventTemplateType;
      }
    }
    // Não permitir converter para grátis se já há bilhetes e atualmente não é grátis
    if (body.isFree !== undefined) {
      const hasTickets = event.ticketTypes.length > 0;
      const wantsFree = body.isFree === true;
      const wasFree = event.isFree === true;

      if (wantsFree && !wasFree && hasTickets) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Este evento já tem bilhetes. Não pode ser convertido em evento grátis.",
          },
          { status: 400 },
        );
      }
      dataUpdate.isFree = body.isFree;
    }
    if (body.coverImageUrl !== undefined) dataUpdate.coverImageUrl = body.coverImageUrl ?? null;
    if (
      isAdmin &&
      body.payoutMode &&
      (body.payoutMode.toUpperCase() === "PLATFORM" || body.payoutMode.toUpperCase() === "ORGANIZER")
    ) {
      dataUpdate.payoutMode = body.payoutMode.toUpperCase() as Prisma.PayoutMode;
    }

    const ticketTypeUpdates = Array.isArray(body.ticketTypeUpdates)
      ? body.ticketTypeUpdates
      : [];
    const newTicketTypes = Array.isArray(body.newTicketTypes) ? body.newTicketTypes : [];

    const payoutMode = event.payoutMode ?? "ORGANIZER";
    const hasExistingPaid = event.ticketTypes.some(
      (t) => (t.price ?? 0) > 0 && t.status !== TicketTypeStatus.CANCELLED
    );
    const hasNewPaid = newTicketTypes.some((nt) => Number(nt.price ?? 0) > 0);
    if (
      payoutMode === "ORGANIZER" &&
      (hasExistingPaid || hasNewPaid) &&
      paymentsStatus !== "READY" &&
      !isAdmin
    ) {
      return NextResponse.json(
        {
          ok: false,
          code: "PAYMENTS_NOT_READY",
          error: "Para vender bilhetes pagos, primeiro liga a tua conta Stripe em Finanças & Payouts.",
        },
        { status: 403 },
      );
    }

    const transactions: Prisma.PrismaPromise<unknown>[] = [];

    if (Object.keys(dataUpdate).length > 0) {
      transactions.push(
        prisma.event.update({
          where: { id: eventId },
          data: dataUpdate,
        }),
      );
    }

    if (ticketTypeUpdates.length > 0) {
      for (const upd of ticketTypeUpdates) {
        const tt = event.ticketTypes.find((t) => t.id === upd.id);
        if (!tt) continue;
        const status =
          upd.status && Object.values(TicketTypeStatus).includes(upd.status)
            ? upd.status
            : null;
        if (status) {
          transactions.push(
            prisma.ticketType.update({
              where: { id: tt.id },
              data: { status },
            }),
          );
        }
      }
    }

    if (newTicketTypes.length > 0) {
      for (const nt of newTicketTypes) {
        const price = Number(nt.price ?? 0);
        const totalQuantity =
          typeof nt.totalQuantity === "number" && nt.totalQuantity > 0
            ? nt.totalQuantity
            : null;
        const startsAt = nt.startsAt ? new Date(nt.startsAt) : null;
        const endsAt = nt.endsAt ? new Date(nt.endsAt) : null;

        transactions.push(
          prisma.ticketType.create({
            data: {
              eventId,
              name: nt.name?.trim() || "Bilhete",
              description: nt.description ?? null,
              price,
              totalQuantity,
              status: TicketTypeStatus.ON_SALE,
              startsAt: startsAt && !Number.isNaN(startsAt.getTime()) ? startsAt : null,
              endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
            },
          }),
        );
      }
    }

    if (transactions.length === 0) {
      return NextResponse.json({ ok: false, error: "Nada para atualizar." }, { status: 400 });
    }

    await prisma.$transaction(transactions);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("POST /api/organizador/events/update error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erro interno ao atualizar evento.",
      },
      { status: 500 },
    );
  }
}
