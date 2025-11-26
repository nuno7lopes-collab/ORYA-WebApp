import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { identifier?: string } | null;
    const identifier = body?.identifier?.trim();

    if (!identifier) {
      return NextResponse.json({ ok: false, error: "IDENTIFIER_REQUIRED" }, { status: 400 });
    }

    if (identifier.includes("@")) {
      return NextResponse.json({ ok: true, email: identifier.toLowerCase() });
    }

    const profile = await prisma.profile.findFirst({
      where: { username: { equals: identifier, mode: "insensitive" } },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "USER_NOT_FOUND" }, { status: 404 });
    }

    const adminClient = createClient(env.supabaseUrl, env.serviceRoleKey);
    const { data, error } = await adminClient.auth.admin.getUserById(profile.id);

    if (error || !data?.user?.email) {
      return NextResponse.json({ ok: false, error: "EMAIL_NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, email: data.user.email.toLowerCase() });
  } catch (err) {
    console.error("[resolve-identifier] error", err);
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
