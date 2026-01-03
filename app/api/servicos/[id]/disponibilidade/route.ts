import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function buildAvailabilityRange(dateParam: string | null, dayParam: string | null) {
  if (dateParam === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (dateParam === "weekend") {
    const now = new Date();
    const day = now.getDay();
    let start = new Date(now);
    let end = new Date(now);
    if (day === 0) {
      start = now;
      end.setHours(23, 59, 59, 999);
    } else {
      const daysToSaturday = (6 - day + 7) % 7;
      start.setDate(now.getDate() + daysToSaturday);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 1);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }

  if (dateParam === "day" && dayParam) {
    const parsed = new Date(dayParam);
    if (!Number.isNaN(parsed.getTime())) {
      const start = new Date(parsed);
      start.setHours(0, 0, 0, 0);
      const end = new Date(parsed);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }

  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const serviceId = Number(params.id);
  if (!Number.isFinite(serviceId)) {
    return NextResponse.json({ ok: false, error: "Serviço inválido." }, { status: 400 });
  }

  try {
    const service = await prisma.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        organization: {
          status: "ACTIVE",
          organizationCategory: "RESERVAS",
        },
      },
      select: { id: true },
    });

    if (!service) {
      return NextResponse.json({ ok: false, error: "Serviço não encontrado." }, { status: 404 });
    }

    const dateParam = req.nextUrl.searchParams.get("date");
    const dayParam = req.nextUrl.searchParams.get("day");
    const range = buildAvailabilityRange(dateParam, dayParam);
    const now = new Date();
    const startBoundary = range
      ? new Date(Math.max(range.start.getTime(), now.getTime()))
      : now;

    const items = await prisma.availability.findMany({
      where: {
        serviceId,
        status: "OPEN",
        startsAt: {
          gte: startBoundary,
          ...(range ? { lte: range.end } : {}),
        },
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        capacity: true,
        status: true,
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    console.error("GET /api/servicos/[id]/disponibilidade error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar horários." }, { status: 500 });
  }
}
