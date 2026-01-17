import { NextRequest, NextResponse } from "next/server";
import { Prisma, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { canManageEvents } from "@/lib/organizationPermissions";

type HistoryRow = {
  broadcast_id: string | null;
  created_at: Date | string | null;
  title: string | null;
  body: string | null;
  event_id: number | null;
  recipients: number | string | null;
  cta_label: string | null;
  cta_url: string | null;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });

    if (!organization || !membership || !canManageEvents(membership.role)) {
      return NextResponse.json({ ok: false, error: "Sem permissoes." }, { status: 403 });
    }

    const moduleEnabled = await prisma.organizationModuleEntry.findFirst({
      where: { organizationId: organization.id, moduleKey: "MENSAGENS", enabled: true },
      select: { moduleKey: true },
    });
    if (!moduleEnabled) {
      return NextResponse.json({ ok: false, error: "Modulo de mensagens desativado." }, { status: 403 });
    }

    const rows = await prisma.$queryRaw<HistoryRow[]>(Prisma.sql`
      SELECT
        payload->>'broadcastId' AS broadcast_id,
        MAX(created_at) AS created_at,
        MAX(title) AS title,
        MAX(body) AS body,
        MAX((payload->'target'->>'eventId')::int) AS event_id,
        COUNT(*)::int AS recipients,
        MAX(cta_label) AS cta_label,
        MAX(cta_url) AS cta_url
      FROM app_v3.notifications
      WHERE organization_id = ${organization.id}
        AND type = ${NotificationType.SYSTEM_ANNOUNCE}
        AND payload->>'source' = 'ORG_BROADCAST'
      GROUP BY payload->>'broadcastId'
      ORDER BY MAX(created_at) DESC
      LIMIT ${limit};
    `);

    const eventIds = rows
      .map((row) => row.event_id)
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
    const eventMap = new Map<number, { title: string; templateType: string | null }>();
    if (eventIds.length > 0) {
      const events = await prisma.event.findMany({
        where: { id: { in: eventIds } },
        select: { id: true, title: true, templateType: true },
      });
      events.forEach((ev) => {
        eventMap.set(ev.id, { title: ev.title, templateType: ev.templateType ?? null });
      });
    }

    const items = rows
      .filter((row) => row.broadcast_id)
      .map((row) => {
        const eventMeta = row.event_id ? eventMap.get(row.event_id) : null;
        const createdAt =
          row.created_at instanceof Date
            ? row.created_at.toISOString()
            : typeof row.created_at === "string"
              ? row.created_at
              : "";
        return {
          broadcastId: row.broadcast_id as string,
          title: row.title ?? null,
          body: row.body ?? null,
          eventId: row.event_id ?? null,
          eventTitle: eventMeta?.title ?? null,
          eventTemplateType: eventMeta?.templateType ?? null,
          createdAt,
          recipients: Number(row.recipients ?? 0),
          ctaLabel: row.cta_label ?? null,
          ctaUrl: row.cta_url ?? null,
        };
      });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Sessao invalida." }, { status: 401 });
    }
    console.error("[mensagens][history] erro inesperado", err);
    return NextResponse.json({ ok: false, error: "Erro interno." }, { status: 500 });
  }
}
