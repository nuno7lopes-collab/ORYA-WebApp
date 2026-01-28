import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { isUnauthenticatedError } from "@/lib/security";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type PushTokenBody = {
  token?: string;
  platform?: "ios";
};

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as PushTokenBody | null;
    const token = body?.token?.trim() ?? "";
    const platform = body?.platform ?? "ios";
    if (!token) {
      return jsonWrap({ ok: false, error: "TOKEN_REQUIRED" }, { status: 400 });
    }
    if (platform !== "ios") {
      return jsonWrap({ ok: false, error: "PLATFORM_UNSUPPORTED" }, { status: 400 });
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

    return jsonWrap({ ok: true, id: stored.id });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[push-tokens] error:", err);
    return jsonWrap({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);