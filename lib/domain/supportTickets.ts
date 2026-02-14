import { SupportTicketCategory, SupportTicketStatus, SupportTicketActorType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { recordOutboxEvent } from "@/domain/outbox/producer";

export const supportTicketCategoryValues = [
  "ORGANIZACOES",
  "BILHETES",
  "PAGAMENTOS_REEMBOLSOS",
  "CONTA_ACESSO",
  "RESERVAS",
  "OUTRO",
] as const;

export const supportTicketStatusValues = ["OPEN", "IN_PROGRESS", "CLOSED"] as const;

export const createSupportTicketSchema = z.object({
  email: z.string().trim().email("EMAIL_INVALID"),
  category: z.enum(supportTicketCategoryValues),
  subject: z.string().trim().min(4, "SUBJECT_TOO_SHORT").max(160, "SUBJECT_TOO_LONG"),
  description: z.string().trim().min(10, "DESCRIPTION_TOO_SHORT").max(6000, "DESCRIPTION_TOO_LONG"),
});

export const supportTicketListQuerySchema = z.object({
  status: z.enum(["ALL", ...supportTicketStatusValues]).optional().default("ALL"),
  category: z.enum(["ALL", ...supportTicketCategoryValues]).optional().default("ALL"),
  q: z.string().trim().optional().default(""),
  from: z.string().trim().optional().default(""),
  to: z.string().trim().optional().default(""),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(25),
});

export const supportTicketStatusUpdateSchema = z.object({
  status: z.enum(supportTicketStatusValues),
});

export const supportTicketEventCreateSchema = z.object({
  eventType: z.string().trim().min(2).max(64).default("ADMIN_NOTE"),
  note: z.string().trim().max(3000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

function normalizeSupportSubject(subject: string, ticketNumber: bigint | number) {
  return `[TICKET-${ticketNumber.toString()}] ${subject.trim()}`;
}

function normalizeStatus(value: string): SupportTicketStatus {
  if (value === "IN_PROGRESS") return SupportTicketStatus.IN_PROGRESS;
  if (value === "CLOSED") return SupportTicketStatus.CLOSED;
  return SupportTicketStatus.OPEN;
}

function normalizeCategory(value: string): SupportTicketCategory {
  if (value === "BILHETES") return SupportTicketCategory.BILHETES;
  if (value === "PAGAMENTOS_REEMBOLSOS") return SupportTicketCategory.PAGAMENTOS_REEMBOLSOS;
  if (value === "CONTA_ACESSO") return SupportTicketCategory.CONTA_ACESSO;
  if (value === "RESERVAS") return SupportTicketCategory.RESERVAS;
  if (value === "OUTRO") return SupportTicketCategory.OUTRO;
  return SupportTicketCategory.ORGANIZACOES;
}

export async function resolveAuthenticatedRequester() {
  try {
    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function createSupportTicket(input: z.infer<typeof createSupportTicketSchema>) {
  const validated = createSupportTicketSchema.parse(input);
  const requester = await resolveAuthenticatedRequester();

  const created = await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: {
        requesterEmail: validated.email,
        requesterUserId: requester?.id ?? null,
        category: normalizeCategory(validated.category),
        subject: validated.subject,
        description: validated.description,
        status: SupportTicketStatus.OPEN,
      },
    });

    const canonicalSubject = normalizeSupportSubject(validated.subject, ticket.ticketNumber);

    const updated = await tx.supportTicket.update({
      where: { id: ticket.id },
      data: { subject: canonicalSubject },
    });

    await tx.supportTicketEvent.create({
      data: {
        ticketId: ticket.id,
        actorType: SupportTicketActorType.REQUESTER,
        actorUserId: requester?.id ?? null,
        eventType: "TICKET_CREATED",
        payload: {
          email: validated.email,
          category: validated.category,
          requesterUserId: requester?.id ?? null,
        },
      },
    });

    await recordOutboxEvent(
      {
        eventType: "support.ticket.created",
        dedupeKey: `support.ticket.created:${ticket.id}`,
        payload: {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber.toString(),
          requesterEmail: validated.email,
          category: validated.category,
          status: "OPEN",
        },
        correlationId: ticket.id,
      },
      tx,
    );

    return updated;
  });

  return created;
}

export async function listSupportTickets(query: z.infer<typeof supportTicketListQuerySchema>) {
  const parsed = supportTicketListQuerySchema.parse(query);

  const where: Record<string, unknown> = {};
  if (parsed.status !== "ALL") {
    where.status = normalizeStatus(parsed.status);
  }
  if (parsed.category !== "ALL") {
    where.category = normalizeCategory(parsed.category);
  }
  if (parsed.q) {
    where.OR = [
      { subject: { contains: parsed.q, mode: "insensitive" } },
      { description: { contains: parsed.q, mode: "insensitive" } },
      { requesterEmail: { contains: parsed.q, mode: "insensitive" } },
    ];
  }

  const fromDate = parsed.from ? new Date(parsed.from) : null;
  const toDate = parsed.to ? new Date(parsed.to) : null;
  if (fromDate || toDate) {
    where.createdAt = {
      ...(fromDate && Number.isFinite(fromDate.getTime()) ? { gte: fromDate } : {}),
      ...(toDate && Number.isFinite(toDate.getTime()) ? { lte: toDate } : {}),
    };
  }

  const skip = (parsed.page - 1) * parsed.pageSize;

  const [total, tickets] = await prisma.$transaction([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { ticketNumber: "desc" }],
      skip,
      take: parsed.pageSize,
      select: {
        id: true,
        ticketNumber: true,
        requesterEmail: true,
        requesterUserId: true,
        category: true,
        subject: true,
        status: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    total,
    page: parsed.page,
    pageSize: parsed.pageSize,
    items: tickets.map((ticket) => ({
      ...ticket,
      ticketNumber: ticket.ticketNumber.toString(),
    })),
  };
}

export async function getSupportTicketDetail(id: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  return ticket;
}

export async function updateSupportTicketStatus(input: {
  id: string;
  status: z.infer<typeof supportTicketStatusUpdateSchema>["status"];
  adminUserId: string;
}) {
  const status = normalizeStatus(input.status);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.supportTicket.findUnique({
      where: { id: input.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new Error("TICKET_NOT_FOUND");
    }

    const updated = await tx.supportTicket.update({
      where: { id: input.id },
      data: {
        status,
        closedAt: status === SupportTicketStatus.CLOSED ? new Date() : null,
      },
    });

    await tx.supportTicketEvent.create({
      data: {
        ticketId: input.id,
        actorType: SupportTicketActorType.ADMIN,
        actorUserId: input.adminUserId,
        eventType: "STATUS_CHANGED",
        payload: {
          from: existing.status,
          to: status,
        },
      },
    });

    await recordOutboxEvent(
      {
        eventType: "support.ticket.status_changed",
        dedupeKey: `support.ticket.status_changed:${input.id}:${updated.updatedAt.toISOString()}`,
        payload: {
          ticketId: input.id,
          from: existing.status,
          to: status,
          actorUserId: input.adminUserId,
        },
        correlationId: input.id,
      },
      tx,
    );

    return updated;
  });
}

export async function addSupportTicketEvent(input: {
  id: string;
  adminUserId: string;
  eventType: string;
  note?: string;
  payload?: Record<string, unknown>;
}) {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!ticket) {
    throw new Error("TICKET_NOT_FOUND");
  }

  const event = await prisma.supportTicketEvent.create({
    data: {
      ticketId: input.id,
      actorType: SupportTicketActorType.ADMIN,
      actorUserId: input.adminUserId,
      eventType: input.eventType,
      payload: {
        ...(input.payload ?? {}),
        ...(input.note ? { note: input.note } : {}),
      },
    },
  });

  await recordOutboxEvent({
    eventType: "support.ticket.event_added",
    dedupeKey: `support.ticket.event_added:${event.id}`,
    payload: {
      ticketId: input.id,
      eventId: event.id,
      actorUserId: input.adminUserId,
      eventType: input.eventType,
    },
    correlationId: input.id,
  });

  return event;
}
