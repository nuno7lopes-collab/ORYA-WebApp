export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { Workbook } from "exceljs";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { OrganizationModule } from "@prisma/client";

const csvEscape = (value: string | null | undefined) => {
  const safe = (value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
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

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  const permission = await ensureMemberModuleAccess({
    organizationId: event.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "VIEW",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const pairings = await prisma.padelPairing.findMany({
    where: { eventId },
    include: {
      category: { select: { label: true } },
      slots: { include: { playerProfile: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const header = ["pairing_id", "categoria", "status", "jogador_1", "jogador_2"];
  const rows = pairings.map((p) => {
    const names = (p.slots ?? [])
      .map((slot) => slot.playerProfile?.displayName || slot.playerProfile?.fullName || "")
      .filter(Boolean);
    return [
      String(p.id),
      p.category?.label ?? "",
      p.pairingStatus,
      names[0] ?? "",
      names[1] ?? "",
    ];
  });

  const format = (req.nextUrl.searchParams.get("format") || "csv").toLowerCase();
  const filenameBase = `padel_inscritos_${event.slug || eventId}`;

  if (format === "xlsx" || format === "excel") {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Inscritos");
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
