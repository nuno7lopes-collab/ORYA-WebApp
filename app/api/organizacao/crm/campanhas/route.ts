import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { campaignChannelsToList, normalizeCampaignChannels } from "@/lib/crm/campaignChannels";
import { CrmCampaignChannel, CrmCampaignStatus, OrganizationMemberRole } from "@prisma/client";

const READ_ROLES = Object.values(OrganizationMemberRole);

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "VIEW",
    });
    if (!crmAccess.ok) {
      return NextResponse.json({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const campaigns = await prisma.crmCampaign.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        channel: true,
        payload: true,
        scheduledAt: true,
        sentAt: true,
        sentCount: true,
        openedCount: true,
        clickedCount: true,
        failedCount: true,
        createdAt: true,
        updatedAt: true,
        segment: { select: { id: true, name: true } },
      },
    });

    const items = campaigns.map((campaign) => {
      const payload = campaign.payload && typeof campaign.payload === "object" ? (campaign.payload as Record<string, unknown>) : null;
      const channels = normalizeCampaignChannels(payload?.channels);
      const { payload: _payload, ...rest } = campaign;
      return {
        ...rest,
        channels: campaignChannelsToList(channels),
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/crm/campanhas error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar campanhas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return NextResponse.json({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as {
      name?: unknown;
      description?: unknown;
      segmentId?: unknown;
      channel?: unknown;
      payload?: unknown;
      scheduledAt?: unknown;
    } | null;

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (name.length < 2) {
      return NextResponse.json({ ok: false, error: "Nome inválido." }, { status: 400 });
    }

    const description = typeof payload?.description === "string" ? payload.description.trim() : null;
    const segmentId = typeof payload?.segmentId === "string" ? payload.segmentId : null;
    const channel = payload?.channel === "IN_APP" ? CrmCampaignChannel.IN_APP : CrmCampaignChannel.IN_APP;
    const rawPayload =
      payload?.payload && typeof payload.payload === "object" && !Array.isArray(payload.payload)
        ? (payload.payload as Record<string, unknown>)
        : {};
    const requestedChannels = payload?.channels ?? rawPayload.channels;
    const channelConfig = normalizeCampaignChannels(requestedChannels);
    const campaignPayload = {
      ...rawPayload,
      channels: channelConfig,
    };
    const scheduledAtRaw = payload?.scheduledAt;
    let scheduledAt: Date | null = null;

    if (typeof scheduledAtRaw === "string" && scheduledAtRaw.trim()) {
      const parsed = new Date(scheduledAtRaw);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ ok: false, error: "Data invalida." }, { status: 400 });
      }
      scheduledAt = parsed;
    } else if (scheduledAtRaw !== null && scheduledAtRaw !== undefined && scheduledAtRaw !== "") {
      return NextResponse.json({ ok: false, error: "Data invalida." }, { status: 400 });
    }

    if (segmentId) {
      const segment = await prisma.crmSegment.findFirst({
        where: { id: segmentId, organizationId: organization.id },
        select: { id: true },
      });
      if (!segment) {
        return NextResponse.json({ ok: false, error: "Segmento inválido." }, { status: 400 });
      }
    }

    const campaign = await prisma.crmCampaign.create({
      data: {
        organizationId: organization.id,
        name,
        description,
        segmentId,
        channel,
        payload: campaignPayload as any,
        scheduledAt,
        status: scheduledAt ? CrmCampaignStatus.SCHEDULED : CrmCampaignStatus.DRAFT,
        createdByUserId: user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        channel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, campaign });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/organizacao/crm/campanhas error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar campanha." }, { status: 500 });
  }
}
