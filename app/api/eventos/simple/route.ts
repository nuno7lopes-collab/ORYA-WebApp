import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { EventCategoryType, EventTemplateType, EventStatus, EventType } from "@prisma/client";

type CreateSimpleEventBody = {
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string;
  locationName?: string;
  locationCity?: string;
  address?: string;
  templateType?: string;
  categories?: string[];
  coverImageUrl?: string | null;
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseDate(raw?: string | null) {
  if (!raw) return null;
  const normalized = raw.replace(" ", "T");
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(`${normalized}:00`);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function normalizeTemplateType(raw?: string | null): EventTemplateType {
  if (!raw) return "OTHER";
  const upper = raw.toUpperCase();
  if (upper === "PADEL") return "PADEL";
  if (upper === "VOLUNTEERING") return "VOLUNTEERING";
  if (upper === "PARTY") return "PARTY";
  if (upper === "TALK") return "TALK";
  return "OTHER";
}

function normalizeCategories(input: string[] | undefined | null): EventCategoryType[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(Object.values(EventCategoryType));
  return input
    .map((c) => c.trim().toUpperCase())
    .filter((c): c is EventCategoryType => allowed.has(c as EventCategoryType));
}

export async function POST(req: NextRequest) {
  try {
    let body: CreateSimpleEventBody | null = null;
    try {
      body = (await req.json()) as CreateSimpleEventBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) {
      return NextResponse.json(
        { ok: false, error: "Perfil não encontrado. Completa o onboarding primeiro." },
        { status: 403 },
      );
    }

    const title = body.title?.trim();
    const description = body.description?.trim() || "";
    const locationCity = body.locationCity?.trim() || "";
    const locationName = body.locationName?.trim() || locationCity || "Local a anunciar";
    const address = body.address?.trim() || null;

    if (!title) {
      return NextResponse.json({ ok: false, error: "Título é obrigatório." }, { status: 400 });
    }
    if (!locationCity) {
      return NextResponse.json({ ok: false, error: "Cidade é obrigatória." }, { status: 400 });
    }

    const startsAt = parseDate(body.startsAt);
    if (!startsAt) {
      return NextResponse.json({ ok: false, error: "Data/hora de início inválida." }, { status: 400 });
    }

    const endsAtParsed = parseDate(body.endsAt);
    const endsAt = endsAtParsed && endsAtParsed >= startsAt ? endsAtParsed : startsAt;

    const categories = normalizeCategories(body.categories);
    if (categories.length === 0) {
      return NextResponse.json({ ok: false, error: "Escolhe pelo menos uma categoria." }, { status: 400 });
    }

    let templateType = normalizeTemplateType(body.templateType);
    if (categories.includes("PADEL")) {
      templateType = "PADEL";
    }

    const slugBase = slugify(title) || "evento";
    let slug = slugBase;
    let counter = 1;
    while (true) {
      const existing = await prisma.event.findUnique({ where: { slug } });
      if (!existing) break;
      slug = `${slugBase}-${counter++}`;
    }

    const event = await prisma.event.create({
      data: {
        slug,
        title,
        description,
        type: EventType.EXPERIENCE,
        templateType,
        organizerId: null,
        startsAt,
        endsAt,
        locationName,
        locationCity,
        address,
        isFree: true,
        status: EventStatus.PUBLISHED,
        coverImageUrl: body.coverImageUrl?.trim?.() || null,
        ownerUserId: user.id,
        categories: {
          createMany: {
            data: categories.map((category) => ({ category })),
            skipDuplicates: true,
          },
        },
      },
    });

    return NextResponse.json({ ok: true, event: { id: event.id, slug: event.slug } }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/eventos/simple error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar evento." }, { status: 500 });
  }
}
