import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SourceType, SearchIndexVisibility } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { pickCanonicalField } from "@/lib/location/eventLocation";

const DEFAULT_LIMIT = 10;

function clampLimit(value: number | null) {
  if (!value || Number.isNaN(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(value, 1), 25);
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  const fail = (status: number, message: string, errorCode = "ERROR") =>
    respondError(ctx, { errorCode, message, retryable: status >= 500 }, { status });

  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const limitParam = searchParams.get("limit");
    const limit = clampLimit(limitParam ? parseInt(limitParam, 10) : null);
    const perGroup = Math.max(3, Math.ceil(limit / 3));

    if (!q) {
      return respondOk(ctx, { query: q, items: [], groups: { organizations: [], events: [], users: [] } });
    }

    const [organizations, events, users] = await Promise.all([
      prisma.organization.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { publicName: { contains: q, mode: "insensitive" } },
            { businessName: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        },
        take: perGroup,
        select: {
          id: true,
          publicName: true,
          businessName: true,
          username: true,
          brandingAvatarUrl: true,
          addressRef: { select: { canonical: true } },
        },
      }),
      prisma.searchIndexItem.findMany({
        where: {
          visibility: SearchIndexVisibility.PUBLIC,
          sourceType: SourceType.EVENT,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { addressRef: { formattedAddress: { contains: q, mode: "insensitive" } } },
          ],
        },
        take: perGroup,
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          sourceId: true,
          slug: true,
          title: true,
          startsAt: true,
          coverImageUrl: true,
          addressRef: { select: { canonical: true } },
          templateType: true,
        },
      }),
      prisma.profile.findMany({
        where: {
          isDeleted: false,
          visibility: "PUBLIC",
          status: "ACTIVE",
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        },
        take: perGroup,
        select: { id: true, fullName: true, username: true, avatarUrl: true },
      }),
    ]);

    const orgItems = organizations.map((org) => ({
      type: "ORGANIZATION" as const,
      id: org.id,
      name: org.publicName || org.businessName || "Organização",
      username: org.username,
      city:
        pickCanonicalField(
          (org.addressRef?.canonical as Record<string, unknown> | null) ?? null,
          "city",
          "locality",
          "addressLine2",
          "region",
          "state",
        ) ?? null,
      avatarUrl: org.brandingAvatarUrl,
    }));

    const eventItems = events.map((event) => ({
      type: "EVENT" as const,
      id: event.sourceId,
      slug: event.slug,
      title: event.title,
      startsAt: event.startsAt,
      coverImageUrl: event.coverImageUrl,
      city:
        pickCanonicalField(
          (event.addressRef?.canonical as Record<string, unknown> | null) ?? null,
          "city",
          "locality",
          "addressLine2",
          "region",
          "state",
        ) ?? null,
      templateType: event.templateType,
    }));

    const userItems = users.map((user) => ({
      type: "USER" as const,
      id: user.id,
      name: user.fullName || user.username || "Utilizador",
      username: user.username,
      avatarUrl: user.avatarUrl,
    }));

    const items = [...orgItems, ...eventItems, ...userItems].slice(0, limit);

    return respondOk(ctx, {
      query: q,
      items,
      groups: {
        organizations: orgItems,
        events: eventItems,
        users: userItems,
      },
    });
  } catch (err) {
    console.error("GET /api/search error:", err);
    return fail(500, "Erro ao pesquisar.", "SEARCH_FAILED");
  }
}

export const GET = withApiEnvelope(_GET);
