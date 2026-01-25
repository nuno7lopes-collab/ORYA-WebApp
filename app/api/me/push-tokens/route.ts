import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { isUnauthenticatedError } from "@/lib/security";

type PushTokenBody = {
  token?: string;
  platform?: "ios";
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as PushTokenBody | null;
    const token = body?.token?.trim() ?? "";
    const platform = body?.platform ?? "ios";
    if (!token) {
      return NextResponse.json({ ok: false, error: "TOKEN_REQUIRED" }, { status: 400 });
    }
    if (platform !== "ios") {
      return NextResponse.json({ ok: false, error: "PLATFORM_UNSUPPORTED" }, { status: 400 });
    }

    const stored = await prisma.pushDeviceToken.upsert({
      where: { platform_token: { platform, token } },
      create: {
        userId: data.user.id,
        platform,
        token,
      },
      update: {
        userId: data.user.id,
        revokedAt: null,
      },
    });

    return NextResponse.json({ ok: true, id: stored.id });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[push-tokens] error:", err);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
