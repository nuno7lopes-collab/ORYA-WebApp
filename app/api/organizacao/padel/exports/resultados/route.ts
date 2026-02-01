export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { Workbook } from "exceljs";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const csvEscape = (value: string | null | undefined) => {
  const safe = (value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
};

const formatScore = (sets?: Array<{ teamA: number; teamB: number }>) => {
  if (!sets || sets.length === 0) return "";
  return sets.map((s) => `${s.teamA}-${s.teamB}`).join(" / ");
};

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true, slug: true },
  });
  if (!event?.organizationId) return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!organization) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const matches = await prisma.eventMatchSlot.findMany({
    where: { eventId },
    include: {
      category: { select: { label: true } },
      pairingA: { include: { slots: { include: { playerProfile: true } } } },
      pairingB: { include: { slots: { include: { playerProfile: true } } } },
    },
    orderBy: [{ roundType: "asc" }, { groupLabel: "asc" }, { id: "asc" }],
  });

  const header = ["match_id", "categoria", "grupo", "round", "team_a", "team_b", "status", "score"];
  const rows = matches.map((m) => {
    const teamA =
      m.pairingA?.slots
        ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || "")
        .filter(Boolean)
        .join(" / ") || "";
    const teamB =
      m.pairingB?.slots
        ?.map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || "")
        .filter(Boolean)
        .join(" / ") || "";
    const scoreSets = Array.isArray(m.scoreSets) ? (m.scoreSets as Array<{ teamA: number; teamB: number }>) : [];
    return [
      String(m.id),
      m.category?.label ?? "",
      m.groupLabel ?? "",
      m.roundLabel ?? m.roundType ?? "",
      teamA,
      teamB,
      m.status,
      formatScore(scoreSets),
    ];
  });

  const format = (req.nextUrl.searchParams.get("format") || "csv").toLowerCase();
  const filenameBase = `padel_resultados_${event.slug || eventId}`;

  if (format === "xlsx" || format === "excel") {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Resultados");
    sheet.addRow(header);
    rows.forEach((row) => sheet.addRow(row));
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  const csv = [header, ...rows].map((line) => line.map(csvEscape).join(",")).join("\n");
  const filename = `${filenameBase}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
export const GET = withApiEnvelope(_GET);
