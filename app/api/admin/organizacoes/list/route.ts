import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";

// @deprecated Slice 5 cleanup: legacy stats (v7 uses ledger).
const LEGACY_STATS_DISABLED = true;

export async function GET(_req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
  }

  if (LEGACY_STATS_DISABLED) {
    return NextResponse.json({ ok: false, error: "LEGACY_STATS_DISABLED" }, { status: 410 });
  }

  return NextResponse.json({ ok: false, error: "LEGACY_STATS_DISABLED" }, { status: 410 });
}
