import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";

type PurgeMode = "ALL" | "KEEP_PROFILES";
type PurgePayload = {
  mode?: PurgeMode;
  confirm?: string;
};

const CONFIRM_ALL = "APAGAR TUDO";
const CONFIRM_KEEP = "APAGAR DADOS";
const ALWAYS_EXCLUDED_TABLES = ["_prisma_migrations"];

export async function POST(req: Request) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
    }

    const body = (await req.json().catch(() => null)) as PurgePayload | null;
    const mode = body?.mode;
    if (mode !== "ALL" && mode !== "KEEP_PROFILES") {
      return NextResponse.json({ ok: false, error: "Modo inv\u00e1lido." }, { status: 400 });
    }

    const expectedConfirm = mode === "ALL" ? CONFIRM_ALL : CONFIRM_KEEP;
    const confirm = typeof body?.confirm === "string" ? body.confirm.trim().toUpperCase() : "";
    if (confirm !== expectedConfirm) {
      return NextResponse.json(
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

    console.warn("[admin/data/purge] completed", {
      mode,
      tableCount: tableNames.length,
      keepProfiles: mode === "KEEP_PROFILES",
      adminUserId: admin.userId,
    });

    return NextResponse.json(
      {
        ok: true,
        mode,
        tableCount: tableNames.length,
        authUsersTruncated: mode === "ALL",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[admin/data/purge] error:", error);
    return NextResponse.json({ ok: false, error: "Erro inesperado." }, { status: 500 });
  }
}
