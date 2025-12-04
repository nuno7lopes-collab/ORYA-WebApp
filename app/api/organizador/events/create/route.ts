

// app/api/organizador/events/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, assertOrganizer } from "@/lib/security";

// Tipos esperados no body do pedido
type TicketTypeInput = {
  name?: string;
  price?: number;
  totalQuantity?: number | null;
};

type CreateOrganizerEventBody = {
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  locationName?: string;
  locationCity?: string;
  templateType?: string; // PARTY | SPORT | VOLUNTEERING | TALK | OTHER
  ticketTypes?: TicketTypeInput[];
  address?: string | null;
  categories?: string[];
  resaleMode?: string; // ALWAYS | AFTER_SOLD_OUT | DISABLED
  coverImageUrl?: string | null;
  isTest?: boolean;
  payoutMode?: string; // ORGANIZER | PLATFORM
  feeMode?: string;
  platformFeeBps?: number;
  platformFeeFixedCents?: number;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  try {
    let body: CreateOrganizerEventBody | null = null;

    try {
      body = (await req.json()) as CreateOrganizerEventBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Body inválido." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    // Confirmar que o profile existe (caso o user tenha contornado o onboarding)
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Perfil não encontrado. Completa o onboarding antes de criares eventos de organizador.",
        },
        { status: 400 }
      );
    }

    // Buscar organizer associado a este profile
    const organizer = await prisma.organizer.findFirst({
      where: {
        userId: profile.id,
        status: "ACTIVE",
      },
    });

    // Garante que o user tem role de organizer e que este organizer pertence-lhe
    assertOrganizer(user, profile, organizer ?? undefined);
    const isAdmin = Array.isArray(profile.roles) ? profile.roles.includes("admin") : false;

    const title = body.title?.trim();
    const description = body.description?.trim() ?? "";
    const startsAtRaw = body.startsAt;
    const endsAtRaw = body.endsAt;
    const locationName = body.locationName?.trim() ?? "";
    const locationCity = body.locationCity?.trim() ?? "";
    const address = body.address?.trim() || null;
    const templateTypeRaw = body.templateType?.toUpperCase() as
      | "PARTY"
      | "SPORT"
      | "VOLUNTEERING"
      | "TALK"
      | "OTHER"
      | undefined;
    const resaleModeRaw = body.resaleMode?.toUpperCase() as
      | "ALWAYS"
      | "AFTER_SOLD_OUT"
      | "DISABLED"
      | undefined;
    const payoutMode = body.payoutMode?.toUpperCase() === "PLATFORM" ? "PLATFORM" : "ORGANIZER";

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "Título é obrigatório." },
        { status: 400 }
      );
    }

    if (!startsAtRaw) {
      return NextResponse.json(
        { ok: false, error: "Data/hora de início é obrigatória." },
        { status: 400 }
      );
    }

    if (!locationCity) {
      return NextResponse.json(
        { ok: false, error: "Cidade é obrigatória." },
        { status: 400 },
      );
    }

    const categoriesInput = Array.isArray(body.categories) ? body.categories : [];
    const allowedCategories = [
      "FESTA",
      "DESPORTO",
      "CONCERTO",
      "PALESTRA",
      "ARTE",
      "COMIDA",
      "DRINKS",
    ];
    const categories = categoriesInput
      .map((c) => c.trim().toUpperCase())
      .filter((c) => allowedCategories.includes(c));

    if (categories.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Escolhe pelo menos uma categoria." },
        { status: 400 },
      );
    }

    const parseDate = (raw?: string | null) => {
      if (!raw) return null;
      const normalized = raw.replace(" ", "T");
      const date = new Date(normalized);
      if (!Number.isNaN(date.getTime())) return date;
      const alt = new Date(`${normalized}:00`);
      if (!Number.isNaN(alt.getTime())) return alt;
      return null;
    };

    const startsAt = parseDate(startsAtRaw);
    if (!startsAt) {
      return NextResponse.json(
        { ok: false, error: "Data/hora de início inválida." },
        { status: 400 }
      );
    }

    // Para simplificar e evitar conflitos de tipos, endsAt será sempre enviado.
    // Se o utilizador não mandar, usamos a mesma data/hora de início.
    const endsAtParsed = parseDate(endsAtRaw);
    const endsAt = endsAtParsed && endsAtParsed >= startsAt ? endsAtParsed : startsAt;

    const templateType =
      templateTypeRaw ??
      (categories.includes("FESTA")
        ? "PARTY"
        : categories.includes("DESPORTO")
          ? "SPORT"
          : categories.includes("PALESTRA")
            ? "TALK"
            : "OTHER");

    const ticketTypesInput = body.ticketTypes ?? [];
    const coverImageUrl = body.coverImageUrl?.trim?.() || null;
    // Validar tipos de bilhete
    const ticketTypesData = ticketTypesInput
      .map((t) => {
        const name = t.name?.trim();
        if (!name) return null;

        const priceRaw =
          typeof t.price === "number" && !Number.isNaN(t.price) ? t.price : 0;

        // preço mínimo 0.50 € (ou 0 para grátis)
        if (priceRaw > 0 && priceRaw < 0.5) {
          throw new Error("O preço mínimo de bilhete é 0,50 € (ou grátis).");
        }

        const totalQuantity =
          typeof t.totalQuantity === "number" && t.totalQuantity > 0
            ? t.totalQuantity
            : null;

        return {
          name,
          price: priceRaw,
          totalQuantity,
        };
      })
      .filter((t): t is { name: string; price: number; totalQuantity: number | null } =>
        Boolean(t)
      );

    const paymentsStatus = organizer
      ? organizer.stripeAccountId
        ? organizer.stripeChargesEnabled && organizer.stripePayoutsEnabled
          ? "READY"
          : "PENDING"
        : "NO_STRIPE"
      : "NO_STRIPE";
    const hasPaidTickets = ticketTypesData.some((t) => t.price > 0);
    if (payoutMode === "ORGANIZER" && hasPaidTickets && paymentsStatus !== "READY" && !isAdmin) {
      return NextResponse.json(
        {
          ok: false,
          code: "PAYMENTS_NOT_READY",
          error: "Para vender bilhetes pagos, primeiro liga a tua conta Stripe em Finanças & Payouts.",
        },
        { status: 403 },
      );
    }

    if (ticketTypesData.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Pelo menos um tipo de bilhete é obrigatório." },
        { status: 400 }
      );
    }

    const baseSlug = slugify(title) || "evento";
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const slug = `${baseSlug}-${randomSuffix}`;
    const resaleMode =
      resaleModeRaw === "AFTER_SOLD_OUT" || resaleModeRaw === "DISABLED"
        ? resaleModeRaw
        : "ALWAYS";

    // Criar o evento primeiro
    const event = await prisma.event.create({
      data: {
        slug,
        title,
        description,
        type: "ORGANIZER_EVENT",
        templateType,
        ownerUserId: profile.id,
        organizerId: organizer?.id ?? null,
        startsAt,
        endsAt,
        locationName,
        locationCity,
        address,
        isFree: ticketTypesData.every((t) => t.price === 0),
        status: "PUBLISHED",
        resaleMode,
        coverImageUrl,
        isTest: isAdmin && body.isTest === true,
        payoutMode,
      },
    });

    // Criar os tipos de bilhete associados a este evento
    await prisma.ticketType.createMany({
      data: ticketTypesData.map((t) => ({
        eventId: event.id,
        name: t.name,
        price: Math.round(t.price * 100), // guardar em cents
        // Assumimos que currency tem default "EUR" e restantes campos têm defaults.
        totalQuantity: t.totalQuantity ?? null,
      })),
    });

    return NextResponse.json(
      {
        ok: true,
        event: {
          id: event.id,
          slug: event.slug,
          title: event.title,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/organizador/events/create error:", err);
    return NextResponse.json(
      { ok: false, error: "Erro interno ao criar evento." },
      { status: 500 }
    );
  }
}
