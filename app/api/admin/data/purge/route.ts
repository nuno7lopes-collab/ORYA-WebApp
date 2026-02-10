import { NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import { auditAdminAction } from "@/lib/admin/audit";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError, logWarn } from "@/lib/observability/logger";

type PurgeMode = "ALL" | "KEEP_PROFILES";
type PurgePayload = {
  mode?: PurgeMode;
  confirm?: string;
};

const CONFIRM_ALL = "APAGAR TUDO";
const CONFIRM_KEEP = "APAGAR DADOS";
const ALWAYS_EXCLUDED_TABLES = ["_prisma_migrations"];

async function _POST(req: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = (await req.json().catch(() => null)) as PurgePayload | null;
    const mode = body?.mode;
    if (mode !== "ALL" && mode !== "KEEP_PROFILES") {
      return jsonWrap({ ok: false, error: "Modo inv\u00e1lido." }, { status: 400 });
    }

    const expectedConfirm = mode === "ALL" ? CONFIRM_ALL : CONFIRM_KEEP;
    const confirm = typeof body?.confirm === "string" ? body.confirm.trim().toUpperCase() : "";
    if (confirm !== expectedConfirm) {
      return jsonWrap(
        { ok: false, error: `Confirma\u00e7\u00e3o inv\u00e1lida. Escreve exatamente: ${expectedConfirm}.` },
        { status: 400 },
      );
    }

    const excluded = new Set<string>(ALWAYS_EXCLUDED_TABLES);
    if (mode === "KEEP_PROFILES") {
      excluded.add("profiles");
    }
    const excludedList = Array.from(excluded);
    const excludeSql = excludedList.length
      ? Prisma.sql`AND table_name NOT IN (${Prisma.join(excludedList)})`
      : Prisma.empty;

    const tables = await prisma.$queryRaw<{ qualified_name: string }[]>(
      Prisma.sql`
        SELECT quote_ident(table_schema) || '.' || quote_ident(table_name) AS qualified_name
        FROM information_schema.tables
        WHERE table_schema = 'app_v3'
          AND table_type = 'BASE TABLE'
          ${excludeSql}
        ORDER BY table_name;
      `,
    );

    const tableNames = tables.map((row) => row.qualified_name);
    if (tableNames.length > 0) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${tableNames.join(", ")} RESTART IDENTITY CASCADE;`,
      );
    }

    if (mode === "ALL") {
      await prisma.$executeRawUnsafe('TRUNCATE TABLE "auth"."users" RESTART IDENTITY CASCADE;');
    }

    logWarn("admin.data_purge.completed", {
      mode,
      tableCount: tableNames.length,
      keepProfiles: mode === "KEEP_PROFILES",
      adminUserId: admin.userId,
    });

    await auditAdminAction({
      action: "DATA_PURGE",
      actorUserId: admin.userId,
      payload: {
        mode,
        tableCount: tableNames.length,
        authUsersTruncated: mode === "ALL",
      },
    });

    return jsonWrap(
      {
        ok: true,
        mode,
        tableCount: tableNames.length,
        authUsersTruncated: mode === "ALL",
      },
      { status: 200 },
    );
  } catch (error) {
    logError("admin.data_purge.failed", error);
    return jsonWrap({ ok: false, error: "Erro inesperado." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
