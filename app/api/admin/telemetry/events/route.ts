import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { requireAdminUser } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import { listTelemetryEvents } from "@/domain/telemetry/query";
import {
  TELEMETRY_SEVERITIES,
  TELEMETRY_SOURCE_TYPES,
  type TelemetrySeverity,
  type TelemetrySourceType,
} from "@/domain/telemetry/constants";
import { logError } from "@/lib/observability/logger";

const DEFAULT_TAKE = 50;
const MAX_TAKE = 200;

function parseTake(value: string | null) {
  const parsed = Number(value ?? DEFAULT_TAKE);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TAKE;
  return Math.min(Math.floor(parsed), MAX_TAKE);
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseSourceType(value: string | null): TelemetrySourceType | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return (TELEMETRY_SOURCE_TYPES as readonly string[]).includes(normalized)
    ? (normalized as TelemetrySourceType)
    : null;
}

function parseSeverity(value: string | null): TelemetrySeverity | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  return (TELEMETRY_SEVERITIES as readonly string[]).includes(normalized)
    ? (normalized as TelemetrySeverity)
    : null;
}

function parseOrganizationId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

async function _GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser({ req });
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status, req });
    }

    const searchParams = req.nextUrl.searchParams;
    const take = parseTake(searchParams.get("take"));
    const sourceType = parseSourceType(searchParams.get("sourceType"));
    const severity = parseSeverity(searchParams.get("severity"));
    const organizationId = parseOrganizationId(searchParams.get("orgId"));

    const result = await listTelemetryEvents({
      organizationId,
      sourceType,
      severity,
      eventName: searchParams.get("eventName"),
      query: searchParams.get("q"),
      from: parseDate(searchParams.get("from")),
      to: parseDate(searchParams.get("to")),
      cursor: searchParams.get("cursor"),
      take,
    });

    const orgIds = Array.from(
      new Set(
        result.items
          .map((item) => item.organizationId)
          .filter((value): value is number => typeof value === "number"),
      ),
    );

    const actorIds = Array.from(
      new Set(
        result.items
          .map((item) => item.actorUserId)
          .filter((value): value is string => typeof value === "string"),
      ),
    );

    const [organizations, actors] = await Promise.all([
      orgIds.length
        ? prisma.organization.findMany({
            where: { id: { in: orgIds } },
            select: { id: true, publicName: true },
          })
        : Promise.resolve([] as Array<{ id: number; publicName: string | null }>),
      actorIds.length
        ? prisma.profile.findMany({
            where: { id: { in: actorIds } },
            select: {
              id: true,
              username: true,
              fullName: true,
              users: { select: { email: true } },
            },
          })
        : Promise.resolve([] as Array<{ id: string; username: string | null; fullName: string | null; users: { email: string | null } | null }>),
    ]);

    const organizationMap = new Map(organizations.map((row) => [row.id, row]));
    const actorMap = new Map(actors.map((row) => [row.id, row]));

    const items = result.items.map((item) => {
      const actor = item.actorUserId ? actorMap.get(item.actorUserId) : null;
      return {
        ...item,
        organization:
          typeof item.organizationId === "number"
            ? organizationMap.get(item.organizationId) ?? null
            : null,
        actor: actor
          ? {
              id: actor.id,
              name: actor.fullName || actor.username || null,
              email: actor.users?.email ?? null,
            }
          : null,
      };
    });

    return jsonWrap(
      {
        ok: true,
        items,
        pagination: result.pagination,
      },
      { status: 200, req },
    );
  } catch (err) {
    logError("admin.telemetry.events_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500, req });
  }
}

export const GET = withApiEnvelope(_GET);
